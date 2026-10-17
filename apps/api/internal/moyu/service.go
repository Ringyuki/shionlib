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
	if !ok || (len(game.Anchors) == 0 && game.SearchTitle() == "") {
		return []Entry{}, nil
	}
	key := EntriesKeyPrefix + strconv.Itoa(gameID)
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
	works, err := s.works(ctx, game)
	if err != nil {
		return nil, err
	}
	vndbID := ""
	for _, anchor := range game.Anchors {
		if anchor.Source == SourceVNDB {
			vndbID = anchor.ID
		}
	}
	return s.patches.Entries(ctx, vndbID, works)
}

func (s *Service) works(ctx context.Context, game Game) ([]string, error) {
	if len(game.Anchors) > 0 {
		named := make([]string, len(game.Anchors))
		for i, anchor := range game.Anchors {
			named[i] = string(anchor.Source) + ":" + anchor.ID
		}
		works, err := remember(ctx, s.cache, WorksKeyPrefix+strings.Join(named, ","), func() ([]string, error) {
			return s.patches.Works(ctx, game.Anchors)
		})
		if err != nil || len(works) > 0 {
			return works, err
		}
	}
	title := game.SearchTitle()
	if title == "" {
		return []string{}, nil
	}
	candidates, err := remember(ctx, s.cache, WorksKeyPrefix+"title:"+TitleKey(title), func() ([]Work, error) {
		return s.patches.Titled(ctx, title)
	})
	if err != nil {
		return nil, err
	}
	works := []string{}
	for _, work := range candidates {
		if game.Names(work) {
			works = append(works, work.ID)
		}
	}
	return works, nil
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

func remember[T any](ctx context.Context, cache Cache, key string, load func() ([]T, error)) ([]T, error) {
	var cached []T
	if found, err := cache.Get(ctx, key, &cached); err == nil && found {
		return listed(cached), nil
	}
	loaded, err := load()
	if err != nil {
		return nil, err
	}
	_ = cache.Set(ctx, key, listed(loaded), WorksTTL)
	return listed(loaded), nil
}

func listed[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}
