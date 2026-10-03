package gameredis

import (
	"context"
	"fmt"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

const recentUpdateKey = "game:recent_update"

type RecentUpdates struct {
	client *redis.Client
}

func NewRecentUpdates(client *redis.Client) *RecentUpdates {
	return &RecentUpdates{client: client}
}

func (r *RecentUpdates) key() string {
	return r.client.Key(recentUpdateKey)
}

func score(at time.Time) string {
	return strconv.FormatInt(at.UnixMilli(), 10)
}

func (r *RecentUpdates) Page(ctx context.Context, offset, count int, expiredBefore time.Time) ([]int, int, error) {
	key := r.key()
	if err := r.client.ZRemRangeByScore(ctx, key, "-inf", score(expiredBefore)).Err(); err != nil {
		return nil, 0, fmt.Errorf("purge recent updates: %w", err)
	}
	if count <= 0 || offset < 0 {
		total, err := r.client.ZCard(ctx, key).Result()
		if err != nil {
			return nil, 0, fmt.Errorf("count recent updates: %w", err)
		}
		return []int{}, int(total), nil
	}
	var (
		members *goredis.StringSliceCmd
		total   *goredis.IntCmd
	)
	_, err := r.client.Pipelined(ctx, func(pipe goredis.Pipeliner) error {
		members = pipe.ZRevRange(ctx, key, int64(offset), int64(offset+count-1))
		total = pipe.ZCard(ctx, key)
		return nil
	})
	if err != nil {
		return nil, 0, fmt.Errorf("read recent updates: %w", err)
	}
	ids := make([]int, 0, len(members.Val()))
	for _, member := range members.Val() {
		if id, err := strconv.Atoi(member); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, int(total.Val()), nil
}

func (r *RecentUpdates) Add(ctx context.Context, gameID int, at time.Time) error {
	err := r.client.ZAdd(ctx, r.key(), goredis.Z{Score: float64(at.UnixMilli()), Member: strconv.Itoa(gameID)}).Err()
	if err != nil {
		return fmt.Errorf("mark game %d as recently updated: %w", gameID, err)
	}
	return nil
}

func (r *RecentUpdates) Remove(ctx context.Context, gameID int) error {
	if err := r.client.ZRem(ctx, r.key(), strconv.Itoa(gameID)).Err(); err != nil {
		return fmt.Errorf("remove game %d from recent updates: %w", gameID, err)
	}
	return nil
}
