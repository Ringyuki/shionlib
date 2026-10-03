package authredis

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Store struct {
	client *redis.Client
}

func NewStore(client *redis.Client) *Store {
	return &Store{client: client}
}

func (s *Store) Put(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if ttl < time.Millisecond {
		ttl = time.Millisecond
	}
	if err := s.client.Set(ctx, s.key(key), value, ttl).Err(); err != nil {
		return fmt.Errorf("store auth state: %w", err)
	}
	return nil
}

func (s *Store) Get(ctx context.Context, key string) ([]byte, bool, error) {
	return read(s.client.Get(ctx, s.key(key)))
}

func (s *Store) Take(ctx context.Context, key string) ([]byte, bool, error) {
	return read(s.client.GetDel(ctx, s.key(key)))
}

func (s *Store) key(key string) string {
	return s.client.Key("auth", key)
}

func read(cmd *goredis.StringCmd) ([]byte, bool, error) {
	value, err := cmd.Bytes()
	switch {
	case errors.Is(err, goredis.Nil):
		return nil, false, nil
	case err != nil:
		return nil, false, fmt.Errorf("read auth state: %w", err)
	default:
		return value, true, nil
	}
}
