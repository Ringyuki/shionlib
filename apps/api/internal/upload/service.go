package upload

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo     Repository
	quota    *QuotaService
	spool    Spool
	tx       Transactor
	settings Settings
	now      func() time.Time
}

func NewService(repo Repository, quota *QuotaService, spool Spool, tx Transactor, settings Settings, now func() time.Time) *Service {
	return &Service{repo: repo, quota: quota, spool: spool, tx: tx, settings: settings, now: now}
}

func (s *Service) Settings() Settings {
	return s.settings
}

func (s *Service) Ongoing(ctx context.Context, who actor.Actor) ([]Session, error) {
	return s.repo.ListUploading(ctx, who.UserID, s.now(), ongoingSessionLimit)
}

func (s *Service) Init(ctx context.Context, who actor.Actor, in InitInput) (Session, error) {
	exceeded, err := s.quota.Exceeds(ctx, who.UserID, in.TotalSize)
	if err != nil {
		return Session{}, err
	}
	if exceeded {
		return Session{}, ErrQuotaExceeded
	}
	chunkSize := s.settings.ChunkSize
	if in.ChunkSize != nil {
		chunkSize = *in.ChunkSize
	}
	if chunkSize <= 0 || chunkSize > s.settings.TransferLimit {
		return Session{}, ErrInvalidChunkSize
	}
	if in.TotalSize <= 0 {
		return Session{}, ErrInvalidTotalSize
	}
	totalChunks := (in.TotalSize + chunkSize - 1) / chunkSize
	if totalChunks > int64(s.settings.MaxChunks) {
		return Session{}, ErrTooManyChunks
	}
	if in.TotalSize > s.settings.MaxFileSize && !who.AtLeast(actor.RoleAdmin) {
		return Session{}, ErrTooLarge
	}
	var session Session
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created, err := s.repo.CreateSession(ctx, NewSession{
			FileName:    in.FileName,
			TotalSize:   in.TotalSize,
			ChunkSize:   chunkSize,
			TotalChunks: int(totalChunks),
			FileHash:    in.FileHash,
			StoragePath: s.spool.Path(PendingStorageName),
			ExpiresAt:   s.now().Add(s.settings.SessionTTL),
			CreatorID:   who.UserID,
		})
		if err != nil {
			return err
		}
		created.StoragePath = s.spool.Path(strconv.Itoa(created.ID))
		if err := s.repo.SetStoragePath(ctx, created.ID, created.StoragePath); err != nil {
			return err
		}
		sessionID := created.ID
		if err := s.quota.AdjustUsed(ctx, who.UserID, ActionUse, in.TotalSize, ReasonGameUpload, &sessionID); err != nil {
			return err
		}
		session = created
		return nil
	})
	if err != nil {
		return Session{}, err
	}
	if err := s.spool.Allocate(ctx, session.StoragePath, session.TotalSize); err != nil {
		_, markErr := s.repo.SetStatus(ctx, session.ID, StatusUploading, StatusAborted, nil)
		return Session{}, errors.Join(fmt.Errorf("allocate upload file: %w", err), markErr)
	}
	return session, nil
}

func (s *Service) WriteChunk(ctx context.Context, who actor.Actor, id, index int, chunk Chunk, body io.Reader) error {
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
	return s.repo.AddChunk(ctx, session.ID, index)
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

func (s *Service) Complete(ctx context.Context, who actor.Actor, id int) error {
	session, err := s.repo.GetSession(ctx, id)
	if err != nil {
		return err
	}
	if session.Status != StatusUploading {
		return ErrInvalidSessionStatus
	}
	if session.ReceivedChunks() != session.TotalChunks {
		return ErrIncomplete
	}
	if session.Expired(s.now()) {
		return ErrSessionExpired
	}
	if session.CreatorID != who.UserID {
		return ErrSessionNotOwner
	}
	digest, err := s.spool.Digest(ctx, session.StoragePath)
	if err != nil {
		return err
	}
	if digest != session.FileHash {
		return ErrFileBLAKE3Mismatch
	}
	mimeType := DefaultMimeType
	changed, err := s.repo.SetStatus(ctx, session.ID, StatusUploading, StatusCompleted, &mimeType)
	if err != nil {
		return err
	}
	if !changed {
		return ErrInvalidSessionStatus
	}
	return nil
}

func (s *Service) Abort(ctx context.Context, who actor.Actor, id int) error {
	var path string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSession(ctx, id)
		if err != nil {
			return err
		}
		if session.Status != StatusUploading {
			return ErrInvalidSessionStatus
		}
		if session.Expired(s.now()) {
			return ErrSessionExpired
		}
		if session.CreatorID != who.UserID {
			return ErrSessionNotOwner
		}
		if _, err := s.repo.SetStatus(ctx, session.ID, StatusUploading, StatusAborted, nil); err != nil {
			return err
		}
		path = session.StoragePath
		return s.quota.Withdraw(ctx, who.UserID, session.ID)
	})
	if err != nil {
		return err
	}
	_ = s.removeOwned(ctx, path)
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
	stale, err := s.repo.ListStale(ctx, s.now().Add(-staleSessionGrace), staleSessionBatch)
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
		if _, err := s.repo.SetStatus(ctx, session.ID, session.Status, StatusExpired, nil); err != nil {
			return err
		}
		path = session.StoragePath
		return s.quota.Withdraw(ctx, session.CreatorID, session.ID)
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
		return !attached, err
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
