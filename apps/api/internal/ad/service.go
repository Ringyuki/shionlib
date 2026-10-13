package ad

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo     Repository
	sponsors Sponsors
	cache    Cache
	now      func() time.Time
}

func NewService(repo Repository, sponsors Sponsors, cache Cache, now func() time.Time) *Service {
	return &Service{repo: repo, sponsors: sponsors, cache: cache, now: now}
}

func (s *Service) Placement(ctx context.Context, viewer actor.Actor, placement string) ([]Ad, error) {
	if viewer.Authenticated() {
		sponsor, err := s.sponsors.IsSponsor(ctx, viewer.UserID, s.now())
		if err != nil {
			return nil, err
		}
		if sponsor {
			return []Ad{}, nil
		}
	}
	key := PlacementCachePrefix + placement
	var cached []Ad
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	ads, err := s.repo.Active(ctx, placement, s.now())
	if err != nil {
		return nil, err
	}
	_ = s.cache.Set(ctx, key, ads, PlacementCacheTTL)
	return ads, nil
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]Ad, int, error) {
	return s.repo.List(ctx, filter, page)
}

func (s *Service) Get(ctx context.Context, id int) (Ad, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Create(ctx context.Context, in NewAd) (Ad, error) {
	if in.Placement == nil {
		in.Placement = []string{}
	}
	if in.ExcludeLocales == nil {
		in.ExcludeLocales = []string{}
	}
	created, err := s.repo.Create(ctx, in)
	if err != nil {
		return Ad{}, err
	}
	s.invalidate(ctx)
	return created, nil
}

func (s *Service) Update(ctx context.Context, id int, changes Changes) (Ad, error) {
	if _, err := s.repo.Get(ctx, id); err != nil {
		return Ad{}, err
	}
	updated, err := s.repo.Update(ctx, id, changes)
	if err != nil {
		return Ad{}, err
	}
	s.invalidate(ctx)
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidate(ctx)
	return nil
}

func (s *Service) invalidate(ctx context.Context) {
	_ = s.cache.DeletePrefix(ctx, PlacementCachePrefix)
}
