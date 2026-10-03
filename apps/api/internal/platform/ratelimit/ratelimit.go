package ratelimit

import (
	"context"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Policy struct {
	Name   string
	Limit  int
	Window time.Duration
	Block  time.Duration
}

type Decision struct {
	Allowed    bool
	Limit      int
	Remaining  int
	ResetAfter time.Duration
	RetryAfter time.Duration
}

var script = goredis.NewScript(`
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return {0, tonumber(ARGV[1]) + 1, blocked, blocked}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[1]) then
  if tonumber(ARGV[3]) > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
    return {0, hits, ttl, tonumber(ARGV[3])}
  end
  return {0, hits, ttl, ttl}
end
return {1, hits, ttl, 0}
`)

type Limiter struct {
	client *redis.Client
}

func New(client *redis.Client) *Limiter {
	return &Limiter{client: client}
}

func (l *Limiter) Allow(ctx context.Context, policy Policy, key string) (Decision, error) {
	counter := l.client.Key("throttle", policy.Name, key)
	block := counter + ":blocked"
	values, err := script.Run(ctx, l.client.Client, []string{counter, block}, policy.Limit, policy.Window.Milliseconds(), policy.Block.Milliseconds()).Int64Slice()
	if err != nil {
		return Decision{}, fmt.Errorf("rate limit %s: %w", policy.Name, err)
	}
	hits := int(values[1])
	return Decision{
		Allowed:    values[0] == 1,
		Limit:      policy.Limit,
		Remaining:  max(0, policy.Limit-hits),
		ResetAfter: time.Duration(max(values[2], 0)) * time.Millisecond,
		RetryAfter: time.Duration(max(values[3], 0)) * time.Millisecond,
	}, nil
}
