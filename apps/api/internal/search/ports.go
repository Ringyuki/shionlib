package search

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Engine interface {
	Search(ctx context.Context, criteria Criteria) (Result, error)
}

type Catalog interface {
	Listable(ctx context.Context, ids []int, visibility game.Visibility) ([]int, error)
}

type TagStore interface {
	Tags(ctx context.Context, query string, limit int) ([]Tag, error)
}

type GameCards interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Preferences interface {
	OnlyGamesWithResources(ctx context.Context, userID int) (bool, error)
}

type Queue interface {
	Enqueue(ctx context.Context, job RecordSearchJob) error
}

type Analytics interface {
	Increment(ctx context.Context, query string, windows []Window, prefixes []string, keep int) error
	Top(ctx context.Context, window Window, limit int) ([]Term, error)
	Suggestions(ctx context.Context, prefix string, limit int) ([]Term, error)
	DecayTrends(ctx context.Context, windows []Window, factor, minScore float64) error
	DecaySuggestions(ctx context.Context, factor, minScore float64) error
	TrimSuggestions(ctx context.Context, keep int) error
}
