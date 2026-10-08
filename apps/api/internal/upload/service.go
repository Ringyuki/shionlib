package upload

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Service struct {
	repo     Repository
	quota    *QuotaService
	spool    Spool
	holds    Holds
	tx       Transactor
	settings setting.Source
	now      func() time.Time
}

func NewService(repo Repository, quota *QuotaService, spool Spool, holds Holds, tx Transactor, settings setting.Source, now func() time.Time) *Service {
	return &Service{repo: repo, quota: quota, spool: spool, holds: holds, tx: tx, settings: settings, now: now}
}

func (s *Service) ChunkLimit() int64 {
	return ChunkLimit.Read(s.settings)
}

func (s *Service) Init(ctx context.Context, who actor.Actor, holder string, in InitInput) (Session, error) {
	chunkLimit := ChunkLimit.Read(s.settings)
	chunkSize := min(ChunkSize.Read(s.settings), chunkLimit)
	if in.ChunkSize != nil {
		chunkSize = *in.ChunkSize
	}
	if chunkSize <= 0 || chunkSize > chunkLimit {
		return Session{}, ErrInvalidChunkSize
	}
	if in.TotalSize <= 0 {
		return Session{}, ErrInvalidTotalSize
	}
	totalChunks := (in.TotalSize + chunkSize - 1) / chunkSize
	if totalChunks > int64(MaxChunks.Read(s.settings)) {
		return Session{}, ErrTooManyChunks
	}
	var session Session
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.admit(ctx, who.UserID, in.TotalSize); err != nil {
			return err
		}
		created, err := s.repo.CreateSession(ctx, NewSession{
			FileName:    in.FileName,
			TotalSize:   in.TotalSize,
			ChunkSize:   chunkSize,
			TotalChunks: int(totalChunks),
			StoragePath: s.spool.Path(PendingStorageName),
			ExpiresAt:   s.now().Add(SessionTTL.Read(s.settings)),
			CreatorID:   who.UserID,
		})
		if err != nil {
			return err
		}
		created.StoragePath = s.spool.Path(strconv.Itoa(created.ID))
		if err := s.repo.SetStoragePath(ctx, created.ID, created.StoragePath); err != nil {
			return err
		}
		session = created
		return nil
	})
	if err != nil {
		return Session{}, err
	}
	if err := s.spool.Allocate(ctx, session.StoragePath, session.TotalSize); err != nil {
		_, markErr := s.repo.SetStatus(ctx, session.ID, StatusUploading, StatusAborted)
		return Session{}, errors.Join(fmt.Errorf("allocate upload file: %w", err), markErr)
	}
	if err := s.keepHold(ctx, session.ID, holder); err != nil {
		return Session{}, err
	}
	return session, nil
}

func (s *Service) admit(ctx context.Context, userID int, size int64) error {
	if err := s.repo.LockAdmission(ctx); err != nil {
		return err
	}
	allowance, err := s.quota.Allowance(ctx, userID)
	if err != nil {
		return err
	}
	if err := allowance.Admit(size); err != nil {
		return err
	}
	room, err := s.SpoolRoom(ctx)
	if err != nil {
		return err
	}
	if room < size {
		return ErrSpoolFull
	}
	return nil
}

func (s *Service) SpoolRoom(ctx context.Context) (int64, error) {
	available, err := s.spool.Available(ctx)
	if err != nil {
		return 0, err
	}
	pending, err := s.repo.PendingBytes(ctx, s.now())
	if err != nil {
		return 0, err
	}
	return available - pending - SpoolReserve.Read(s.settings), nil
}

func (s *Service) WriteChunk(ctx context.Context, who actor.Actor, holder string, id, index int, chunk Chunk, body io.Reader) error {
	session, err := s.repo.GetSession(ctx, id)
	if err != nil {
		return err
	}
	if session.Status != StatusUploading {
		return ErrInvalidSessionStatus
	}
	if index < 0 || index >= session.TotalChunks {
		return ErrInvalidChunkIndex
	}
	if session.Expired(s.now()) {
		return ErrSessionExpired
	}
	if session.CreatorID != who.UserID {
		return ErrSessionNotOwner
	}
	if err := s.keepHold(ctx, session.ID, holder); err != nil {
		return err
	}
	expected := session.ChunkLength(index)
	if expected != chunk.ContentLength {
		return ErrUnexpectedLength.WithArgs(map[string]any{"expected": strconv.FormatInt(expected, 10), "actual": strconv.FormatInt(chunk.ContentLength, 10)})
	}
	offset := session.ChunkOffset(index)
	if session.HasChunk(index) {
		digest, err := s.spool.DigestRange(ctx, session.StoragePath, offset, expected)
		if err != nil {
			return err
		}
		if digest != chunk.SHA256 {
			return ErrInvalidChunkSHA256
		}
		return nil
	}
	digest, err := s.spool.Write(ctx, session.StoragePath, offset, body, expected)
	if err != nil {
		return err
	}
	if digest != chunk.SHA256 {
		return ErrChunkSHA256Mismatch
	}
	return s.repo.AddChunk(ctx, session.ID, index, s.now().Add(SessionTTL.Read(s.settings)))
}

func (s *Service) Status(ctx context.Context, who actor.Actor, id int) (Session, error) {
	session, err := s.repo.GetSession(ctx, id)
	if err != nil {
		return Session{}, err
	}
	if session.Expired(s.now()) {
		return Session{}, ErrSessionExpired
	}
	if session.CreatorID != who.UserID {
		return Session{}, ErrSessionNotOwner
	}
	return session, nil
}

func (s *Service) Complete(ctx context.Context, who actor.Actor, holder string, id int, fileHash string) error {
	session, err := s.repo.GetSession(ctx, id)
	if err != nil {
		return err
	}
	if session.CreatorID != who.UserID {
		return ErrSessionNotOwner
	}
	if session.Status == StatusCompleted && session.FileHash == fileHash {
		return nil
	}
	if session.Status != StatusUploading {
		return ErrInvalidSessionStatus
	}
	if err := s.keepHold(ctx, session.ID, holder); err != nil {
		return err
	}
	if session.ReceivedChunks() != session.TotalChunks {
		return ErrIncomplete
	}
	if session.Expired(s.now()) {
		return ErrSessionExpired
	}
	digest, err := s.spool.Digest(ctx, session.StoragePath)
	if err != nil {
		return err
	}
	if digest != fileHash {
		return ErrFileBLAKE3Mismatch
	}
	changed, err := s.repo.Complete(ctx, session.ID, digest, DefaultMimeType)
	if err != nil {
		return err
	}
	if !changed {
		return ErrInvalidSessionStatus
	}
	return nil
}

func (s *Service) Abort(ctx context.Context, who actor.Actor, holder string, id int) error {
	var path string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSession(ctx, id)
		if err != nil {
			return err
		}
		if session.CreatorID != who.UserID {
			return ErrSessionNotOwner
		}
		if err := s.discardable(ctx, session); err != nil {
			return err
		}
		if err := s.keepHold(ctx, session.ID, holder); err != nil {
			return err
		}
		if _, err := s.repo.SetStatus(ctx, session.ID, session.Status, StatusAborted); err != nil {
			return err
		}
		path = session.StoragePath
		return nil
	})
	if err != nil {
		return err
	}
	_ = s.removeOwned(ctx, path)
	return nil
}

func (s *Service) discardable(ctx context.Context, session Session) error {
	switch session.Status {
	case StatusUploading:
		if session.Expired(s.now()) {
			return ErrSessionExpired
		}
		return nil
	case StatusCompleted:
		attached, err := s.repo.HasFile(ctx, session.ID)
		if err != nil {
			return err
		}
		if attached {
			return ErrSessionAlreadyUsed
		}
		return nil
	default:
		return ErrInvalidSessionStatus
	}
}

func (s *Service) Ongoing(ctx context.Context, who actor.Actor, holder string) ([]OngoingSession, error) {
	sessions, err := s.repo.ListOngoing(ctx, who.UserID, s.now(), ongoingSessionLimit)
	if err != nil {
		return nil, err
	}
	ids := make([]int, len(sessions))
	for i, session := range sessions {
		ids[i] = session.ID
	}
	holders, err := s.holds.Holders(ctx, ids)
	if err != nil {
		return nil, err
	}
	ongoing := make([]OngoingSession, len(sessions))
	for i, session := range sessions {
		held := holders[session.ID]
		ongoing[i] = OngoingSession{Session: session, HeldElsewhere: held != "" && held != holder}
	}
	return ongoing, nil
}

func (s *Service) Hold(ctx context.Context, who actor.Actor, holder string, ids []int) (Holdings, error) {
	sessions, err := s.repo.ListOngoing(ctx, who.UserID, s.now(), ongoingSessionLimit)
	if err != nil {
		return Holdings{}, err
	}
	ttl := HoldTTL.Read(s.settings)
	holdings := Holdings{Held: []int{}, Elsewhere: []int{}, TTL: ttl}
	for _, session := range sessions {
		if !slices.Contains(ids, session.ID) {
			continue
		}
		held, err := s.holds.Hold(ctx, session.ID, holder, ttl)
		if err != nil {
			return Holdings{}, err
		}
		if held {
			holdings.Held = append(holdings.Held, session.ID)
		} else {
			holdings.Elsewhere = append(holdings.Elsewhere, session.ID)
		}
	}
	return holdings, nil
}

func (s *Service) keepHold(ctx context.Context, sessionID int, holder string) error {
	if holder == "" {
		holders, err := s.holds.Holders(ctx, []int{sessionID})
		if err != nil {
			return err
		}
		if holders[sessionID] != "" {
			return ErrHeldElsewhere
		}
		return nil
	}
	held, err := s.holds.Hold(ctx, sessionID, holder, HoldTTL.Read(s.settings))
	if err != nil {
		return err
	}
	if !held {
		return ErrHeldElsewhere
	}
	return nil
}

func (s *Service) Claim(ctx context.Context, who actor.Actor, id int) (Session, error) {
	session, err := s.repo.LockSession(ctx, id)
	if err != nil {
		return Session{}, err
	}
	if session.Status != StatusCompleted {
		return Session{}, ErrInvalidSessionStatus
	}
	if session.CreatorID != who.UserID {
		return Session{}, ErrSessionNotOwner
	}
	return session, nil
}

func (s *Service) CleanStaleSessions(ctx context.Context) error {
	now := s.now()
	stale, err := s.repo.ListStale(ctx, now, now.Add(-staleSessionGrace), staleSessionBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, candidate := range stale {
		if err := s.expire(ctx, candidate.ID); err != nil {
			errs = append(errs, fmt.Errorf("expire upload session %d: %w", candidate.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) expire(ctx context.Context, id int) error {
	var path string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSession(ctx, id)
		if errors.Is(err, ErrSessionNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		stale, err := s.isStale(ctx, session)
		if err != nil || !stale {
			return err
		}
		if _, err := s.repo.SetStatus(ctx, session.ID, session.Status, StatusExpired); err != nil {
			return err
		}
		path = session.StoragePath
		return nil
	})
	if err != nil {
		return err
	}
	return s.removeOwned(ctx, path)
}

func (s *Service) isStale(ctx context.Context, session Session) (bool, error) {
	cutoff := s.now().Add(-staleSessionGrace)
	switch session.Status {
	case StatusAborted:
		return true, nil
	case StatusExpired:
		return false, nil
	case StatusCompleted:
		if !session.Updated.Before(cutoff) {
			return false, nil
		}
		attached, err := s.repo.HasFile(ctx, session.ID)
		if err != nil || attached {
			return false, err
		}
		live, err := s.repo.HasLiveUpload(ctx, session.CreatorID, s.now())
		return !live, err
	default:
		return session.ExpiresAt.Before(cutoff), nil
	}
}

func (s *Service) CleanOrphans(ctx context.Context) error {
	candidates, err := s.spool.Stale(ctx, s.now().Add(-orphanFileTTL))
	if err != nil || len(candidates) == 0 {
		return err
	}
	referenced, err := s.repo.ReferencedPaths(ctx, candidates)
	if err != nil {
		return err
	}
	var errs []error
	for _, path := range candidates {
		if referenced[path] {
			continue
		}
		if err := s.spool.Remove(ctx, path); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *Service) removeOwned(ctx context.Context, path string) error {
	if path == "" || !s.spool.Owns(path) {
		return nil
	}
	return s.spool.Remove(ctx, path)
}
