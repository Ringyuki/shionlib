package analysis

import (
	"context"
	"time"
)

type Stats interface {
	Totals(ctx context.Context) (Totals, error)
	Games(ctx context.Context, ids []int) (map[int]GameRef, error)
	RatedFiles(ctx context.Context, fileIDs []int) (map[int]bool, error)
}

type BytesServed interface {
	BytesServed(ctx context.Context, since, until time.Time) (int64, error)
}

type DownloadTraffic interface {
	Traffic(ctx context.Context, window Window) (RawTraffic, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}
