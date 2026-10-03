package game

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Cover struct {
	Language string
	Type     string
	URL      string
	Dims     []int
	Sexual   int
	Violence int
}

func (c Cover) Rated() bool {
	return c.Sexual > 0
}

type DeveloperRef struct {
	ID      int
	Name    string
	Aliases []string
}

type Credit struct {
	Role      string
	Developer DeveloperRef
}

type Card struct {
	ID          int
	Views       int
	TitleJP     string
	TitleZH     string
	TitleEN     string
	Aliases     []string
	Type        *string
	Covers      []Cover
	IntroJP     string
	IntroZH     string
	IntroEN     string
	ReleaseDate *time.Time
	Developers  []Credit
}

func (c Card) VisibleTo(viewer actor.Actor) Card {
	if viewer.IncludesRated() {
		return c
	}
	visible := c
	visible.Covers = slices.DeleteFunc(slices.Clone(c.Covers), Cover.Rated)
	return visible
}

type CardStore interface {
	Cards(ctx context.Context, ids []int) ([]Card, error)
	Exists(ctx context.Context, id int) (bool, error)
}

type Cards struct {
	store CardStore
}

func NewCards(store CardStore) *Cards {
	return &Cards{store: store}
}

func (c *Cards) ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]Card, error) {
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
		byID[card.ID] = card.VisibleTo(viewer)
	}
	return byID, nil
}

func (c *Cards) Exists(ctx context.Context, id int) (bool, error) {
	return c.store.Exists(ctx, id)
}
