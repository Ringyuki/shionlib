package moyu

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Games interface {
	Game(ctx context.Context, gameID int, viewer actor.Actor) (Game, bool, error)
}

type Assignments interface {
	Assigned(ctx context.Context, gameID int) (Game, error)
	Assign(ctx context.Context, gameID int, pages []string, by int) error
	Unassign(ctx context.Context, gameID int) error
}

type Patches interface {
	Works(ctx context.Context, anchors []Anchor) ([]string, error)
	Entries(ctx context.Context, query PageQuery) ([]Entry, error)
	Pages(ctx context.Context, query PageQuery) ([]Page, error)
	PageOfResource(ctx context.Context, resourceID string) (string, bool, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	Delete(ctx context.Context, keys ...string) error
}
