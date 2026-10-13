package authredis

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type FamilyBlocklist struct {
	client *redis.Client
}

func NewFamilyBlocklist(client *redis.Client) *FamilyBlocklist {
	return &FamilyBlocklist{client: client}
}

func (b *FamilyBlocklist) Blocked(ctx context.Context, familyID string) (bool, error) {
	if familyID == "" {
		return false, nil
	}
	err := b.client.Get(ctx, b.key(familyID)).Err()
	switch {
	case err == nil:
		return true, nil
	case errors.Is(err, goredis.Nil):
		return false, nil
	default:
		return false, fmt.Errorf("read family block: %w", err)
	}
}

func (b *FamilyBlocklist) Block(ctx context.Context, familyID string, ttl time.Duration) error {
	if ttl < time.Second {
		ttl = time.Second
	}
	if err := b.client.Set(ctx, b.key(familyID), "1", ttl).Err(); err != nil {
		return fmt.Errorf("write family block: %w", err)
	}
	return nil
}

func (b *FamilyBlocklist) key(familyID string) string {
	return b.client.Key("auth", "family", "blocked", familyID)
}
