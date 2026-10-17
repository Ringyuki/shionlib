package moyu

import (
	"context"
	"errors"
	"strconv"
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
	game, ok, err := s.games.Game(ctx, gameID, viewer)
	if err != nil {
		return nil, err
	}
	if !ok || !game.Findable() {
		return []Entry{}, nil
	}
	key := entriesKey(gameID)
	var cached []Entry
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return listed(cached), nil
	}
	lookup, cancel := context.WithTimeout(ctx, RequestTimeout)
	defer cancel()
	entries, err := s.fetch(lookup, game)
	if err != nil {
		_ = s.cache.Set(ctx, key, []Entry{}, FailureTTL)
		return nil, err
	}
	_ = s.cache.Set(ctx, key, listed(entries), CacheTTL)
	return listed(entries), nil
}

func (s *Service) fetch(ctx context.Context, game Game) ([]Entry, error) {
	if game.Assigned {
		return s.patches.Entries(ctx, PageQuery{IDs: game.Pages})
	}
	works, err := worksOf(ctx, s.cache, s.patches, game.Anchors)
	if err != nil {
		return nil, err
	}
	return s.patches.Entries(ctx, PageQuery{VNDBID: game.VNDBID(), Works: works})
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

func entriesKey(gameID int) string {
	return EntriesKeyPrefix + strconv.Itoa(gameID)
}

func worksOf(ctx context.Context, cache Cache, patches Patches, anchors []Anchor) ([]string, error) {
	if len(anchors) == 0 {
		return []string{}, nil
	}
	named := make([]string, len(anchors))
	for i, anchor := range anchors {
		named[i] = string(anchor.Source) + ":" + anchor.ID
	}
	key := WorksKeyPrefix + strings.Join(named, ",")
	var cached []string
	if found, err := cache.Get(ctx, key, &cached); err == nil && found {
		return listed(cached), nil
	}
	works, err := patches.Works(ctx, anchors)
	if err != nil {
		return nil, err
	}
	_ = cache.Set(ctx, key, listed(works), WorksTTL)
	return listed(works), nil
}

func listed[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}
