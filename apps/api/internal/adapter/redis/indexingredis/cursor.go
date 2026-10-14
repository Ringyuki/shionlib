package indexingredis

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

const cursorKey = "indexing:cursor"

type Cursor struct {
	client *redis.Client
}

func NewCursor(client *redis.Client) *Cursor {
	return &Cursor{client: client}
}

func (c *Cursor) Load(ctx context.Context) (time.Time, bool, error) {
	raw, err := c.client.Get(ctx, c.client.Key(cursorKey)).Result()
	if errors.Is(err, goredis.Nil) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, fmt.Errorf("load indexing cursor: %w", err)
	}
	at, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return time.Time{}, false, fmt.Errorf("read indexing cursor %q: %w", raw, err)
	}
	return at, true, nil
}

func (c *Cursor) Save(ctx context.Context, at time.Time) error {
	if err := c.client.Set(ctx, c.client.Key(cursorKey), at.UTC().Format(time.RFC3339Nano), 0).Err(); err != nil {
		return fmt.Errorf("save indexing cursor: %w", err)
	}
	return nil
}
