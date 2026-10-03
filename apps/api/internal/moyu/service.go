package moyu

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	games   Games
	patches Patches
	cache   Cache
}

func NewService(games Games, patches Patches, cache Cache) *Service {
	return &Service{games: games, patches: patches, cache: cache}
}

func (s *Service) Resources(ctx context.Context, viewer actor.Actor, gameID int) ([]Resource, error) {
	vndbID, ok, err := s.games.VNDBID(ctx, gameID, viewer)
	if err != nil {
		return nil, err
	}
	if !ok || vndbID == "" {
		return nil, ErrPatchNotFound
	}
	lookup, err := s.lookup(ctx, vndbID)
	if err != nil {
		return nil, err
	}
	if !lookup.Found {
		return nil, ErrPatchNotFound
	}
	if lookup.Resources == nil {
		return []Resource{}, nil
	}
	return lookup.Resources, nil
}

func (s *Service) lookup(ctx context.Context, vndbID string) (Lookup, error) {
	key := CacheKeyPrefix + vndbID
	var cached Lookup
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	lookup, err := s.patches.ResourcesByVNDBID(ctx, vndbID)
	if err != nil {
		return Lookup{}, err
	}
	_ = s.cache.Set(ctx, key, lookup, CacheTTL)
	return lookup, nil
}
