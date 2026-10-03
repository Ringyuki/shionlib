package bangumiredis

import (
	"context"
	"errors"
	"fmt"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type TokenStore struct {
	client *redis.Client
}

func NewTokenStore(client *redis.Client) *TokenStore {
	return &TokenStore{client: client}
}

func (s *TokenStore) Key() string {
	return s.client.Key("bangumi", "tokens")
}

func (s *TokenStore) Load(ctx context.Context) ([]byte, bool, error) {
	raw, err := s.client.Get(ctx, s.Key()).Bytes()
	if errors.Is(err, goredis.Nil) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("load bangumi tokens: %w", err)
	}
	return raw, true, nil
}

func (s *TokenStore) Save(ctx context.Context, raw []byte) error {
	if err := s.client.Set(ctx, s.Key(), raw, 0).Err(); err != nil {
		return fmt.Errorf("save bangumi tokens: %w", err)
	}
	return nil
}
