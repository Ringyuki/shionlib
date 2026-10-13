package composition

import (
	"context"
	"errors"
	"slices"
)

type CleanService struct {
	drafts *Service
}

func NewCleanService(drafts *Service) *CleanService {
	return &CleanService{drafts: drafts}
}

func (c *CleanService) Clean(ctx context.Context) error {
	s := c.drafts
	cutoff := s.now().Add(-DraftTTL.Read(s.settings))
	stale, err := s.repo.StaleDrafts(ctx, cutoff, staleDraftBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, id := range stale {
		err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
			composition, err := s.repo.Lock(ctx, id)
			if errors.Is(err, ErrNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			if composition.State != StateDraft || composition.Updated.After(cutoff) {
				return nil
			}
			return s.drop(ctx, composition)
		})
		errs = append(errs, err)
	}
	return errors.Join(append(errs, c.sweep(ctx), c.requeue(ctx))...)
}

func (c *CleanService) requeue(ctx context.Context) error {
	s := c.drafts
	unsettled, err := s.repo.Unsettled(ctx, unsettledBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, composition := range unsettled {
		if composition.Active() {
			errs = append(errs, s.queue.Enqueue(ctx, Run{CompositionID: composition.ID}))
			continue
		}
		for _, role := range []Role{RolePatch, RoleSave} {
			if input := composition.input(role); input != nil && input.State == InputReading {
				errs = append(errs, s.queue.Enqueue(ctx, Read{CompositionID: composition.ID, Role: role}))
			}
		}
	}
	return errors.Join(errs...)
}

func (c *CleanService) sweep(ctx context.Context) error {
	s := c.drafts
	dirs, err := s.stage.Dirs(ctx)
	if err != nil || len(dirs) == 0 {
		return err
	}
	kept, err := s.repo.Existing(ctx, dirs)
	if err != nil {
		return err
	}
	var errs []error
	for _, id := range dirs {
		if slices.Contains(kept, id) {
			continue
		}
		dir, err := s.stage.Open(ctx, id)
		if err == nil {
			err = s.stage.Discard(ctx, dir)
		}
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}
