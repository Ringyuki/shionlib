package gameredis_test

import (
	"context"
	"slices"
	"testing"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/gameredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestRecentUpdatesPagesByScoreAndPurgesExpired(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	recent := gameredis.NewRecentUpdates(client)
	now := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	for i, id := range []int{1, 2, 9} {
		if err := recent.Add(ctx, id, now.Add(time.Duration(i)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	if err := recent.Add(ctx, 5, now.Add(-40*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := client.ZAdd(ctx, client.Key("game:recent_update"), redisZ("garbage", now)).Err(); err != nil {
		t.Fatal(err)
	}

	ids, total, err := recent.Page(ctx, 0, 2, now.Add(-30*24*time.Hour))
	if err != nil || total != 4 || !slices.Equal(ids, []int{9, 2}) {
		t.Fatalf("first page: %v %d %v", ids, total, err)
	}
	ids, _, _ = recent.Page(ctx, 2, 2, now.Add(-30*24*time.Hour))
	if !slices.Equal(ids, []int{1}) {
		t.Fatalf("second page skips non-numeric members: %v", ids)
	}
	if exists, _ := client.ZScore(ctx, client.Key("game:recent_update"), "5").Result(); exists != 0 {
		t.Fatalf("expired entries are purged: %v", exists)
	}
	if err := recent.Remove(ctx, 9); err != nil {
		t.Fatal(err)
	}
	if ids, _, _ := recent.Page(ctx, 0, 10, now.Add(-30*24*time.Hour)); slices.Contains(ids, 9) {
		t.Fatalf("removed game still listed: %v", ids)
	}
}

func redisZ(member string, at time.Time) goredis.Z {
	return goredis.Z{Score: float64(at.UnixMilli()), Member: member}
}
