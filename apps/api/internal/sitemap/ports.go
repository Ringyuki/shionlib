package sitemap

import (
	"context"
	"time"
)

type Store interface {
	Count(ctx context.Context, section Section) (int, error)
	Entries(ctx context.Context, section Section, offset, limit int) ([]Entry, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}
