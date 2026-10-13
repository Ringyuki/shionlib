package search

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type Catalog interface {
	Search(ctx context.Context, sourceName string, entity catalog.Entity, query string, page, size int) (catalog.SearchResult, error)
	Resolve(ctx context.Context, sourceName string, entity catalog.Entity, externalIDs []string) (map[string]int, error)
}

type Games interface {
	Listable(ctx context.Context, ids []int, visibility game.Visibility) ([]int, error)
	Referenced(ctx context.Context, reference game.Reference) ([]int, error)
}

type Preferences interface {
	OnlyGamesWithResources(ctx context.Context, userID int) (bool, error)
}

type GameCards interface {
	ByIDs(ctx context.Context, ids []int, viewer actor.Actor) (map[int]game.Card, error)
}

type Developers interface {
	Summaries(ctx context.Context, ids []int) (map[int]developer.Summary, error)
}

type Characters interface {
	Summaries(ctx context.Context, ids []int) (map[int]character.Summary, error)
}

type Titles interface {
	Titles(ctx context.Context, prefix string, visibility game.Visibility, limit int) ([]string, error)
}

type TagStore interface {
	Tags(ctx context.Context, query string, limit int) ([]Tag, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}

type Queue interface {
	Enqueue(ctx context.Context, job RecordSearchJob) error
}

type Analytics interface {
	Increment(ctx context.Context, query string, windows []Window) error
	Top(ctx context.Context, window Window, limit int) ([]Term, error)
	DecayTrends(ctx context.Context, windows []Window, factor, minScore float64) error
}
