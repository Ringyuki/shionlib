package comment

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type PinService struct {
	repo      Repository
	resources Resources
	tx        Transactor
	now       func() time.Time
}

func NewPinService(repo Repository, resources Resources, tx Transactor, now func() time.Time) *PinService {
	return &PinService{repo: repo, resources: resources, tx: tx, now: now}
}

func (s *PinService) Pin(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if !target.Pinnable() {
			return ErrNotPinnable
		}
		resource, err := s.resources.Viewable(ctx, who, *target.ResourceID)
		if err != nil {
			return err
		}
		if resource.CreatorID != who.UserID {
			return ErrNotPublisher
		}
		if err := s.repo.ClearPin(ctx, resource.ID); err != nil {
			return err
		}
		return s.repo.SetPin(ctx, target.ID, s.now())
	})
}

func (s *PinService) Unpin(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if target.ResourceID == nil || !target.Pinned() {
			return nil
		}
		if !who.AtLeast(actor.RoleAdmin) {
			resource, err := s.resources.Viewable(ctx, who, *target.ResourceID)
			if err != nil {
				return err
			}
			if resource.CreatorID != who.UserID {
				return ErrNotPublisher
			}
		}
		return s.repo.ClearPin(ctx, *target.ResourceID)
	})
}
