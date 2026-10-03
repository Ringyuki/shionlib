package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Cache struct {
	client *redis.Client
}

func New(client *redis.Client) *Cache {
	return &Cache{client: client}
}

func (c *Cache) Get(ctx context.Context, key string, dst any) (bool, error) {
	raw, err := c.client.Get(ctx, c.client.Key("cache", key)).Bytes()
	if errors.Is(err, goredis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("cache get %s: %w", key, err)
	}
	if err := json.Unmarshal(raw, dst); err != nil {
		return false, fmt.Errorf("cache decode %s: %w", key, err)
	}
	return true, nil
}

func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache encode %s: %w", key, err)
	}
	if err := c.client.Set(ctx, c.client.Key("cache", key), raw, ttl).Err(); err != nil {
		return fmt.Errorf("cache set %s: %w", key, err)
	}
	return nil
}

func (c *Cache) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	full := make([]string, len(keys))
	for i, key := range keys {
		full[i] = c.client.Key("cache", key)
	}
	if err := c.client.Unlink(ctx, full...).Err(); err != nil {
		return fmt.Errorf("cache delete: %w", err)
	}
	return nil
}

func (c *Cache) DeletePrefix(ctx context.Context, prefix string) error {
	pattern := c.client.Key("cache", prefix) + "*"
	var cursor uint64
	for {
		keys, next, err := c.client.Scan(ctx, cursor, pattern, 500).Result()
		if err != nil {
			return fmt.Errorf("cache scan %s: %w", prefix, err)
		}
		if len(keys) > 0 {
			if err := c.client.Unlink(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("cache delete prefix %s: %w", prefix, err)
			}
		}
		if next == 0 {
			return nil
		}
		cursor = next
	}
}
