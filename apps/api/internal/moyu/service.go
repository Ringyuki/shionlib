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

func (s *Service) Entries(ctx context.Context, viewer actor.Actor, gameID int) ([]Entry, error) {
	vndbID, ok, err := s.games.VNDBID(ctx, gameID, viewer)
	if err != nil {
		return nil, err
	}
	if !ok || vndbID == "" {
		return []Entry{}, nil
	}
	key := CacheKeyPrefix + vndbID
	var cached []Entry
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return listed(cached), nil
	}
	entries, err := s.patches.EntriesByVNDBID(ctx, vndbID)
	if err != nil {
		_ = s.cache.Set(ctx, key, []Entry{}, FailureTTL)
		return nil, err
	}
	_ = s.cache.Set(ctx, key, listed(entries), CacheTTL)
	return listed(entries), nil
}

func listed(entries []Entry) []Entry {
	if entries == nil {
		return []Entry{}
	}
	return entries
}
