package ratelimit_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestFixedWindowWithBlock(t *testing.T) {
	limiter := ratelimit.New(redistest.New(t))
	ctx := context.Background()
	policy := ratelimit.Policy{Name: "test", Limit: 2, Window: 400 * time.Millisecond, Block: 1200 * time.Millisecond}
	for i := range 2 {
		decision, err := limiter.Allow(ctx, policy, "ip")
		if err != nil || !decision.Allowed || decision.Remaining != 1-i {
			t.Fatalf("request %d: %+v %v", i, decision, err)
		}
	}
	denied, err := limiter.Allow(ctx, policy, "ip")
	if err != nil || denied.Allowed || denied.RetryAfter < time.Second {
		t.Fatalf("third request must be blocked for the block duration: %+v %v", denied, err)
	}
	time.Sleep(600 * time.Millisecond)
	stillBlocked, err := limiter.Allow(ctx, policy, "ip")
	if err != nil || stillBlocked.Allowed {
		t.Fatalf("block must outlast the window: %+v %v", stillBlocked, err)
	}
	other, err := limiter.Allow(ctx, policy, "other-ip")
	if err != nil || !other.Allowed {
		t.Fatalf("keys are independent: %+v %v", other, err)
	}
	time.Sleep(800 * time.Millisecond)
	recovered, err := limiter.Allow(ctx, policy, "ip")
	if err != nil || !recovered.Allowed {
		t.Fatalf("requests are allowed again after the block: %+v %v", recovered, err)
	}
}

func TestPaceQueuesCallsAnIntervalApart(t *testing.T) {
	limiter := ratelimit.New(redistest.New(t))
	ctx := context.Background()
	pace := ratelimit.Pace{Name: "test", Interval: 300 * time.Millisecond, MaxWait: 500 * time.Millisecond}
	first, ok, err := limiter.Reserve(ctx, pace)
	if err != nil || !ok || first != 0 {
		t.Fatalf("the first call goes at once: %s %v %v", first, ok, err)
	}
	second, ok, err := limiter.Reserve(ctx, pace)
	if err != nil || !ok || second < 250*time.Millisecond || second > 300*time.Millisecond {
		t.Fatalf("the second call waits for its turn: %s %v %v", second, ok, err)
	}
	if third, ok, err := limiter.Reserve(ctx, pace); err != nil || ok || third != 0 {
		t.Fatalf("a call that would wait past the limit is turned away: %s %v %v", third, ok, err)
	}
	if other, ok, err := limiter.Reserve(ctx, ratelimit.Pace{Name: "other", Interval: time.Second, MaxWait: 0}); err != nil || !ok || other != 0 {
		t.Fatalf("paces are independent: %s %v %v", other, ok, err)
	}
	time.Sleep(700 * time.Millisecond)
	if again, ok, err := limiter.Reserve(ctx, pace); err != nil || !ok || again != 0 {
		t.Fatalf("an idle pace lets the next call go at once: %s %v %v", again, ok, err)
	}
}
