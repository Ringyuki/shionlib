package moyu

import (
	"context"
	"errors"
	"strings"

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

func (s *Service) ByHash(ctx context.Context, viewer actor.Actor, gameID int, sha256 string) (Entry, bool, error) {
	hash := strings.ToLower(strings.TrimSpace(sha256))
	if hash == "" {
		return Entry{}, false, nil
	}
	entries, err := s.Entries(ctx, viewer, gameID)
	if errors.Is(err, ErrRequestFailed) {
		return Entry{}, false, nil
	}
	if err != nil {
		return Entry{}, false, err
	}
	for _, entry := range entries {
		if entry.Hash == hash {
			return entry, true, nil
		}
	}
	return Entry{}, false, nil
}

func listed(entries []Entry) []Entry {
	if entries == nil {
		return []Entry{}
	}
	return entries
}
