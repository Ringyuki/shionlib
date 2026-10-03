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
