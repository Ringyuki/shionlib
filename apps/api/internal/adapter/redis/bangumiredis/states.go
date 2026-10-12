package bangumiredis

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type StateStore struct {
	client *redis.Client
}

func NewStateStore(client *redis.Client) *StateStore {
	return &StateStore{client: client}
}

func (s *StateStore) key(state string) string {
	return s.client.Key("bangumi", "oauth", state)
}

func (s *StateStore) Save(ctx context.Context, state, returnTo string, ttl time.Duration) error {
	if err := s.client.Set(ctx, s.key(state), returnTo, ttl).Err(); err != nil {
		return fmt.Errorf("save bangumi authorization state: %w", err)
	}
	return nil
}

func (s *StateStore) Take(ctx context.Context, state string) (string, bool, error) {
	returnTo, err := s.client.GetDel(ctx, s.key(state)).Result()
	if errors.Is(err, goredis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("take bangumi authorization state: %w", err)
	}
	return returnTo, true, nil
}
