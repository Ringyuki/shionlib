package searchredis

import (
	"context"
	"fmt"
	"strconv"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

const scanBatch = 200

type Analytics struct {
	client *redis.Client
}

func NewAnalytics(client *redis.Client) *Analytics {
	return &Analytics{client: client}
}

func (a *Analytics) trendKey(window search.Window) string {
	return a.client.Key("search", "trends", string(window))
}

func (a *Analytics) suggestKey(prefix string) string {
	return a.client.Key("search", "suggest", prefix)
}

func (a *Analytics) suggestPattern() string {
	return a.client.Key("search", "suggest") + ":*"
}

func trimStop(keep int) int64 {
	return int64(-(keep + 1))
}

func (a *Analytics) Increment(ctx context.Context, query string, windows []search.Window, prefixes []string, keep int) error {
	_, err := a.client.Pipelined(ctx, func(pipe goredis.Pipeliner) error {
		for _, window := range windows {
			pipe.ZIncrBy(ctx, a.trendKey(window), 1, query)
		}
		for _, prefix := range prefixes {
			key := a.suggestKey(prefix)
			pipe.ZIncrBy(ctx, key, 1, query)
			pipe.ZRemRangeByRank(ctx, key, 0, trimStop(keep))
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("record search %q: %w", query, err)
	}
	return nil
}

func (a *Analytics) top(ctx context.Context, key string, limit int) ([]search.Term, error) {
	if limit <= 0 {
		return []search.Term{}, nil
	}
	members, err := a.client.ZRevRangeWithScores(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("read search terms: %w", err)
	}
	terms := make([]search.Term, len(members))
	for i, member := range members {
		terms[i] = search.Term{Query: memberString(member.Member), Score: member.Score}
	}
	return terms, nil
}

func memberString(member any) string {
	switch typed := member.(type) {
	case string:
		return typed
	case int64:
		return strconv.FormatInt(typed, 10)
	default:
		return fmt.Sprint(typed)
	}
}

func (a *Analytics) Top(ctx context.Context, window search.Window, limit int) ([]search.Term, error) {
	return a.top(ctx, a.trendKey(window), limit)
}

func (a *Analytics) Suggestions(ctx context.Context, prefix string, limit int) ([]search.Term, error) {
	return a.top(ctx, a.suggestKey(prefix), limit)
}

func (a *Analytics) decay(ctx context.Context, keys []string, factor, minScore float64) error {
	_, err := a.client.Pipelined(ctx, func(pipe goredis.Pipeliner) error {
		for _, key := range keys {
			pipe.ZUnionStore(ctx, key, &goredis.ZStore{Keys: []string{key}, Weights: []float64{factor}})
			pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatFloat(minScore, 'f', -1, 64))
		}
		return nil
	})
	return err
}

func (a *Analytics) DecayTrends(ctx context.Context, windows []search.Window, factor, minScore float64) error {
	keys := make([]string, len(windows))
	for i, window := range windows {
		keys[i] = a.trendKey(window)
	}
	if err := a.decay(ctx, keys, factor, minScore); err != nil {
		return fmt.Errorf("decay search trends: %w", err)
	}
	return nil
}

func (a *Analytics) DecaySuggestions(ctx context.Context, factor, minScore float64) error {
	return a.eachSuggestBatch(ctx, func(keys []string) error {
		if err := a.decay(ctx, keys, factor, minScore); err != nil {
			return fmt.Errorf("decay search suggestions: %w", err)
		}
		return nil
	})
}

func (a *Analytics) TrimSuggestions(ctx context.Context, keep int) error {
	return a.eachSuggestBatch(ctx, func(keys []string) error {
		_, err := a.client.Pipelined(ctx, func(pipe goredis.Pipeliner) error {
			for _, key := range keys {
				pipe.ZRemRangeByRank(ctx, key, 0, trimStop(keep))
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("trim search suggestions: %w", err)
		}
		return nil
	})
}

func (a *Analytics) eachSuggestBatch(ctx context.Context, fn func(keys []string) error) error {
	var cursor uint64
	for {
		keys, next, err := a.client.Scan(ctx, cursor, a.suggestPattern(), scanBatch).Result()
		if err != nil {
			return fmt.Errorf("scan search suggestions: %w", err)
		}
		if len(keys) > 0 {
			if err := fn(keys); err != nil {
				return err
			}
		}
		if next == 0 {
			return nil
		}
		cursor = next
	}
}
