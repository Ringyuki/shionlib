package moyu

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Games interface {
	VNDBID(ctx context.Context, gameID int, viewer actor.Actor) (string, bool, error)
}

type Patches interface {
	ResourcesByVNDBID(ctx context.Context, vndbID string) (Lookup, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}
