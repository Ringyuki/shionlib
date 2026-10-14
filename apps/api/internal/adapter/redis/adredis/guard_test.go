package adredis_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/adredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestOnlyTheFirstMarkWithinTheWindowCounts(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	guard := adredis.NewClickGuard(client)
	if first, err := guard.First(ctx, "ad:click:1:a", time.Minute); err != nil || !first {
		t.Fatalf("first mark: %v %v", first, err)
	}
	if again, err := guard.First(ctx, "ad:click:1:a", time.Minute); err != nil || again {
		t.Fatalf("repeated mark: %v %v", again, err)
	}
	if other, err := guard.First(ctx, "ad:click:1:b", time.Minute); err != nil || !other {
		t.Fatalf("another visitor: %v %v", other, err)
	}
	if ttl := client.TTL(ctx, client.Key("ad:click:1:a")).Val(); ttl <= 0 || ttl > time.Minute {
		t.Fatalf("the mark expires with the window: %v", ttl)
	}
}
