package walkthroughredis

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

const quotaKeptFor = 48 * time.Hour

type FormatQuota struct {
	client *redis.Client
}

func NewFormatQuota(client *redis.Client) *FormatQuota {
	return &FormatQuota{client: client}
}

func (q *FormatQuota) Take(ctx context.Context, userID int, day string, limit int) (bool, error) {
	key := q.client.Key("walkthrough", "format", "quota", day, strconv.Itoa(userID))
	pipe := q.client.TxPipeline()
	taken := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, quotaKeptFor)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, fmt.Errorf("count formatting by user %d: %w", userID, err)
	}
	return taken.Val() <= int64(limit), nil
}
