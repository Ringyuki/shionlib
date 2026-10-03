package gametest

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Cards struct {
	cards map[int]game.Card
}

func NewCards(cards ...game.Card) *Cards {
	byID := make(map[int]game.Card, len(cards))
	for _, card := range cards {
		byID[card.ID] = card
	}
	return &Cards{cards: byID}
}

func (c *Cards) Exists(_ context.Context, id int) (bool, error) {
	_, ok := c.cards[id]
	return ok, nil
}

func (c *Cards) ByIDs(_ context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error) {
	result := map[int]game.Card{}
	for _, id := range slices.Compact(slices.Sorted(slices.Values(ids))) {
		if card, ok := c.cards[id]; ok {
			result[id] = card.VisibleTo(viewer)
		}
	}
	return result, nil
}
