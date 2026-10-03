package favoritetest

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Games struct {
	cards map[int]game.Card
}

func NewGames(cards ...game.Card) *Games {
	byID := make(map[int]game.Card, len(cards))
	for _, card := range cards {
		byID[card.ID] = card
	}
	return &Games{cards: byID}
}

func (g *Games) Exists(_ context.Context, id int) (bool, error) {
	_, ok := g.cards[id]
	return ok, nil
}

func (g *Games) ByIDs(_ context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error) {
	result := map[int]game.Card{}
	for _, id := range slices.Compact(slices.Sorted(slices.Values(ids))) {
		if card, ok := g.cards[id]; ok {
			result[id] = card.VisibleTo(viewer)
		}
	}
	return result, nil
}

type ImmediateTransactor struct {
	Calls int
}

func (t *ImmediateTransactor) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	t.Calls++
	return fn(ctx)
}
