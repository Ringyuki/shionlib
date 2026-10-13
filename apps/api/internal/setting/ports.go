package setting

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
)

type Scalar interface {
	int | int64 | float64 | time.Duration | bool | string
}

type Source interface {
	Lookup(name string) (any, bool)
}

type Repository interface {
	Values(ctx context.Context) ([]StoredValue, error)
	Value(ctx context.Context, name string) (StoredValue, bool, error)
	Save(ctx context.Context, name string, value json.RawMessage) error
	Remove(ctx context.Context, name string) error
	Record(ctx context.Context, change NewChange) error
	LatestChanges(ctx context.Context) ([]Change, error)
	Changes(ctx context.Context, name string, page paging.Page) ([]Change, int, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type Announcer interface {
	Announce(ctx context.Context)
}
