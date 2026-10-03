package activity

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo  Repository
	games GameCards
}

func NewService(repo Repository, games GameCards) *Service {
	return &Service{repo: repo, games: games}
}

func (s *Service) Record(ctx context.Context, in NewActivity) error {
	return s.repo.Create(ctx, in)
}

func (s *Service) Feed(ctx context.Context, viewer actor.Actor, category *Category, page Page) ([]Entry, int, error) {
	filter := Filter{ExcludeRated: !viewer.IncludesRated()}
	if category != nil {
		filter.Types = category.Types()
	}
	entries, total, err := s.repo.List(ctx, filter, page)
	if err != nil {
		return nil, 0, err
	}
	var ids []int
	for _, entry := range entries {
		if entry.GameID != nil {
			ids = append(ids, *entry.GameID)
		}
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	for i, entry := range entries {
		if entry.GameID == nil {
			continue
		}
		if card, ok := cards[*entry.GameID]; ok {
			entries[i].Game = &card
		}
	}
	return entries, total, nil
}
