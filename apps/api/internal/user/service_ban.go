package user

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type BanInput struct {
	BannedBy       *int
	Reason         *string
	DurationDays   *int
	Permanent      bool
	DeleteComments bool
}

func (s *Service) Ban(ctx context.Context, id int, in BanInput) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.banTarget(ctx, id)
		if err != nil {
			return err
		}
		if target.Banned() {
			return ErrAlreadyBanned
		}
		if !in.Permanent && (in.DurationDays == nil || *in.DurationDays <= 0) {
			return ErrInvalidBanDuration
		}
		if err := s.repo.CreateBan(ctx, NewBan{
			UserID:       id,
			BannedBy:     in.BannedBy,
			Reason:       in.Reason,
			DurationDays: in.DurationDays,
			Permanent:    in.Permanent,
		}); err != nil {
			return err
		}
		banned := StatusBanned
		if err := s.repo.Update(ctx, id, Changes{Status: &banned}); err != nil {
			return err
		}
		if err := s.sessions.RevokeUser(ctx, id, reasonBanned); err != nil {
			return err
		}
		if in.DeleteComments {
			return s.repo.DeleteComments(ctx, id)
		}
		return nil
	})
}

func (s *Service) Penalize(ctx context.Context, id int, bannedBy *int, reason string, days int) (bool, error) {
	applied := false
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.banTarget(ctx, id)
		if errors.Is(err, ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if target.Banned() {
			return nil
		}
		if days <= 0 {
			return ErrInvalidBanDuration
		}
		if err := s.repo.CreateBan(ctx, NewBan{UserID: id, BannedBy: bannedBy, Reason: &reason, DurationDays: &days}); err != nil {
			return err
		}
		banned := StatusBanned
		if err := s.repo.Update(ctx, id, Changes{Status: &banned}); err != nil {
			return err
		}
		if err := s.sessions.RevokeUser(ctx, id, reasonBanned); err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, err
}

func (s *Service) Unban(ctx context.Context, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.banTarget(ctx, id)
		if err != nil {
			return err
		}
		if !target.Banned() {
			return ErrAlreadyUnbanned
		}
		return s.lift(ctx, id)
	})
}

func (s *Service) UnbanExpired(ctx context.Context) error {
	bans, err := s.repo.ActiveBans(ctx)
	if err != nil {
		return err
	}
	now := s.now()
	var errs []error
	for _, ban := range bans {
		until, temporary := ban.ExpiresAt()
		if !temporary || until.After(now) {
			continue
		}
		err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
			target, err := s.repo.Lock(ctx, ban.UserID)
			if err != nil {
				return err
			}
			if !target.Banned() {
				return nil
			}
			return s.lift(ctx, ban.UserID)
		})
		if err != nil && !errors.Is(err, ErrNotFound) {
			errs = append(errs, fmt.Errorf("unban user %d: %w", ban.UserID, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) lift(ctx context.Context, id int) error {
	if err := s.repo.CloseLatestBan(ctx, id, s.now()); err != nil {
		return err
	}
	active := StatusActive
	return s.repo.Update(ctx, id, Changes{Status: &active})
}

func (s *Service) banTarget(ctx context.Context, id int) (User, error) {
	target, err := s.repo.Lock(ctx, id)
	if err != nil {
		return User{}, err
	}
	if target.Role == actor.RoleSuperAdmin {
		return User{}, ErrNotFound
	}
	return target, nil
}
