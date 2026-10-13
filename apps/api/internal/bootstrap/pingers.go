package bootstrap

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type redisPinger struct {
	client *redis.Client
}

func (p redisPinger) Ping(ctx context.Context) error {
	return p.client.Client.Ping(ctx).Err()
}
