package apikeyredis

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

const (
	requestsField  = "r"
	throttledField = "t"
	keptFor        = 3 * 24 * time.Hour
)

type Counter struct {
	client *redis.Client
}

func NewCounter(client *redis.Client) *Counter {
	return &Counter{client: client}
}

func (c *Counter) dayKey(day time.Time) string {
	return c.client.Key("apikey", "usage", day.Format(time.DateOnly))
}

func (c *Counter) Count(ctx context.Context, keyID int, day time.Time, throttled bool) error {
	field := requestsField
	if throttled {
		field = throttledField
	}
	key := c.dayKey(day)
	_, err := c.client.Pipelined(ctx, func(pipe goredis.Pipeliner) error {
		pipe.HIncrBy(ctx, key, strconv.Itoa(keyID)+":"+field, 1)
		pipe.Expire(ctx, key, keptFor)
		return nil
	})
	if err != nil {
		return fmt.Errorf("count a request of API key %d: %w", keyID, err)
	}
	return nil
}

func (c *Counter) Counts(ctx context.Context, day time.Time) ([]apikey.Count, error) {
	values, err := c.client.HGetAll(ctx, c.dayKey(day)).Result()
	if err != nil {
		return nil, fmt.Errorf("read API key usage of %s: %w", day.Format(time.DateOnly), err)
	}
	byKey := map[int]*apikey.Count{}
	for field, raw := range values {
		id, kind, found := strings.Cut(field, ":")
		keyID, idErr := strconv.Atoi(id)
		value, valueErr := strconv.Atoi(raw)
		if !found || idErr != nil || valueErr != nil {
			continue
		}
		count, ok := byKey[keyID]
		if !ok {
			count = &apikey.Count{KeyID: keyID, Day: day}
			byKey[keyID] = count
		}
		if kind == throttledField {
			count.Throttled = value
		} else {
			count.Requests = value
		}
	}
	counts := make([]apikey.Count, 0, len(byKey))
	for _, count := range byKey {
		counts = append(counts, *count)
	}
	slices.SortFunc(counts, func(a, b apikey.Count) int { return a.KeyID - b.KeyID })
	return counts, nil
}
