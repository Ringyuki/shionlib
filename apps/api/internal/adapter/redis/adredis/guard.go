package adredis

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type ClickGuard struct {
	client *redis.Client
}

func NewClickGuard(client *redis.Client) *ClickGuard {
	return &ClickGuard{client: client}
}

func (g *ClickGuard) First(ctx context.Context, key string, window time.Duration) (bool, error) {
	first, err := g.client.SetNX(ctx, g.client.Key(key), 1, window).Result()
	if err != nil {
		return false, fmt.Errorf("mark %s: %w", key, err)
	}
	return first, nil
}
