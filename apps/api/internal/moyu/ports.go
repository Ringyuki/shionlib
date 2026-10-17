package moyu

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Games interface {
	Game(ctx context.Context, gameID int, viewer actor.Actor) (Game, bool, error)
}

type Patches interface {
	Works(ctx context.Context, anchors []Anchor) ([]string, error)
	Titled(ctx context.Context, title string) ([]Work, error)
	Entries(ctx context.Context, vndbID string, works []string) ([]Entry, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}
