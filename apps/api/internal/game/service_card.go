package game

import (
	"context"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type CardService struct {
	store  CardStore
	masker PictureMasker
}

func NewCardService(store CardStore, masker PictureMasker) *CardService {
	return &CardService{store: store, masker: masker}
}

func (c *CardService) ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]Card, error) {
	unique := slices.Compact(slices.Sorted(slices.Values(ids)))
	if len(unique) == 0 {
		return map[int]Card{}, nil
	}
	cards, err := c.store.Cards(ctx, unique)
	if err != nil {
		return nil, err
	}
	byID := make(map[int]Card, len(cards))
	for _, card := range cards {
		byID[card.ID] = card.VisibleTo(viewer, c.masker)
	}
	return byID, nil
}

func (c *CardService) Exists(ctx context.Context, id int) (bool, error) {
	return c.store.Exists(ctx, id)
}
