package potatovn

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo     Repository
	catalog  Catalog
	client   Client
	covers   Covers
	tx       Transactor
	schedule ScheduleSync
	now      func() time.Time
}

func NewService(repo Repository, catalog Catalog, client Client, covers Covers, tx Transactor, schedule ScheduleSync, now func() time.Time) *Service {
	return &Service{repo: repo, catalog: catalog, client: client, covers: covers, tx: tx, schedule: schedule, now: now}
}

func (s *Service) Binding(ctx context.Context, who actor.Actor) (Binding, error) {
	return s.repo.Binding(ctx, who.UserID)
}

func (s *Service) Bind(ctx context.Context, who actor.Actor, userName, password string) (Binding, error) {
	if _, err := s.repo.Binding(ctx, who.UserID); err == nil {
		return Binding{}, ErrBindingAlreadyExists
	} else if !errors.Is(err, ErrBindingNotFound) {
		return Binding{}, err
	}
	session, err := s.client.Login(ctx, userName, password)
	if err != nil {
		return Binding{}, err
	}
	binding, err := s.repo.CreateBinding(ctx, NewBinding{
		UserID:       who.UserID,
		PVNUserID:    session.UserID,
		PVNUserName:  session.UserName,
		Token:        session.Token,
		TokenExpires: session.Expires,
	})
	if err != nil {
		return Binding{}, err
	}
	_ = s.schedule(ctx, SyncLibraryJob{UserID: who.UserID})
	return binding, nil
}

func (s *Service) Unbind(ctx context.Context, who actor.Actor) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.repo.Binding(ctx, who.UserID); err != nil {
			return err
		}
		if err := s.repo.DeleteMappings(ctx, who.UserID); err != nil {
			return err
		}
		return s.repo.DeleteBinding(ctx, who.UserID)
	})
}

func (s *Service) RefreshToken(ctx context.Context, userID int) error {
	binding, err := s.repo.Binding(ctx, userID)
	if err != nil {
		return err
	}
	session, err := s.client.Refresh(ctx, binding.Token)
	if err != nil {
		return ErrBindingAuthFailed.Wrap(err)
	}
	return s.repo.UpdateToken(ctx, userID, session.Token, session.Expires)
}

func (s *Service) RefreshExpiringTokens(ctx context.Context) error {
	userIDs, err := s.repo.BindingsExpiringBefore(ctx, s.now().Add(RefreshThreshold))
	if err != nil {
		return err
	}
	var errs []error
	for _, userID := range userIDs {
		if err := s.RefreshToken(ctx, userID); err != nil && !errors.Is(err, ErrBindingNotFound) {
			errs = append(errs, fmt.Errorf("refresh potatovn token of user %d: %w", userID, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) CleanExpiredBindings(ctx context.Context) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		_, err := s.repo.DeleteExpiredBindings(ctx, s.now())
		return err
	})
}

func (s *Service) ScheduleLibrarySyncs(ctx context.Context) error {
	after := 0
	var errs []error
	for {
		userIDs, err := s.repo.BindingUserIDs(ctx, after, SyncScheduleBatch)
		if err != nil {
			return errors.Join(append(errs, err)...)
		}
		for _, userID := range userIDs {
			if err := s.schedule(ctx, SyncLibraryJob{UserID: userID}); err != nil {
				errs = append(errs, fmt.Errorf("schedule potatovn sync of user %d: %w", userID, err))
			}
		}
		if len(userIDs) < SyncScheduleBatch {
			return errors.Join(errs...)
		}
		after = userIDs[len(userIDs)-1]
	}
}

func (s *Service) SyncLibrary(ctx context.Context, userID int) error {
	binding, err := s.repo.Binding(ctx, userID)
	if errors.Is(err, ErrBindingNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	for page := range MaxLibraryPages {
		library, err := s.client.Library(ctx, binding.Token, page, LibraryPageSize)
		if err != nil {
			return err
		}
		for _, galgame := range library.Items {
			if err := s.syncGalgame(ctx, userID, galgame); err != nil {
				return err
			}
		}
		if page >= library.PageCount-1 {
			return nil
		}
	}
	return nil
}

func (s *Service) syncGalgame(ctx context.Context, userID int, galgame Galgame) error {
	bangumiID, vndbID := galgame.localBangumiID(), galgame.localVNDBID()
	if bangumiID == nil && vndbID == nil {
		return nil
	}
	gameID, found, err := s.catalog.MatchGame(ctx, bangumiID, vndbID)
	if err != nil || !found {
		return err
	}
	err = s.repo.SyncMapping(ctx, NewMapping{
		UserID:       userID,
		GameID:       gameID,
		PVNGalgameID: galgame.ID,
		PlayData:     galgame.PlayData(),
		SyncedAt:     s.now(),
	})
	if errors.Is(err, ErrMappingConflict) {
		return nil
	}
	return err
}

func (s *Service) GameData(ctx context.Context, who actor.Actor, gameID int) (Mapping, error) {
	return s.repo.Mapping(ctx, who.UserID, gameID)
}

func (s *Service) AddGame(ctx context.Context, who actor.Actor, gameID int) (Mapping, error) {
	if existing, err := s.repo.Mapping(ctx, who.UserID, gameID); err == nil {
		return existing, nil
	} else if !errors.Is(err, ErrMappingNotFound) {
		return Mapping{}, err
	}
	info, err := s.catalog.GameInfo(ctx, gameID)
	if err != nil {
		return Mapping{}, err
	}
	binding, err := s.repo.Binding(ctx, who.UserID)
	if err != nil {
		return Mapping{}, err
	}
	draft := info.draft()
	if info.CoverKey != nil {
		if location, ok := s.uploadCover(ctx, binding.Token, gameID, *info.CoverKey); ok {
			draft.ImageLoc = &location
		}
	}
	galgame, err := s.client.SaveGalgame(ctx, binding.Token, draft)
	if err != nil {
		return Mapping{}, err
	}
	mapping, err := s.repo.CreateMapping(ctx, NewMapping{
		UserID:       who.UserID,
		GameID:       gameID,
		PVNGalgameID: galgame.ID,
		PlayData:     galgame.PlayData(),
		SyncedAt:     s.now(),
	})
	if errors.Is(err, ErrMappingConflict) {
		if existing, lookupErr := s.repo.Mapping(ctx, who.UserID, gameID); lookupErr == nil {
			return existing, nil
		}
	}
	return mapping, err
}

func (s *Service) RemoveGame(ctx context.Context, who actor.Actor, gameID int) error {
	mapping, err := s.repo.Mapping(ctx, who.UserID, gameID)
	if err != nil {
		return err
	}
	binding, err := s.repo.Binding(ctx, who.UserID)
	if err != nil {
		return err
	}
	if err := s.client.RemoveGalgame(ctx, binding.Token, mapping.PVNGalgameID); err != nil && !errors.Is(err, ErrRemoteGalgameMissing) {
		return err
	}
	return s.repo.DeleteMapping(ctx, who.UserID, gameID)
}

func (s *Service) uploadCover(ctx context.Context, token string, gameID int, key string) (string, bool) {
	cover, err := s.covers.Fetch(ctx, key, MaxCoverBytes)
	if err != nil || len(cover.Data) == 0 {
		return "", false
	}
	if cover.ContentType == "" {
		cover.ContentType = DefaultCoverContentType
	}
	objectName := fmt.Sprintf("shionlib/game/%d/%s.webp", gameID, uuid.NewString())
	uploadURL, err := s.client.ReserveImage(ctx, token, objectName, len(cover.Data))
	if err != nil {
		return "", false
	}
	uploadErr := s.client.UploadImage(ctx, uploadURL, cover)
	_ = s.client.CommitImage(ctx, token, objectName)
	return objectName, uploadErr == nil
}
