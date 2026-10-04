package searchredis_test

import (
	"context"
	"math"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/searchredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func TestAnalyticsLifecycle(t *testing.T) {
	client := redistest.New(t)
	ctx := context.Background()
	analytics := searchredis.NewAnalytics(client)
	windows := []search.Window{search.WindowHour, search.WindowDay}

	for _, query := range []string{"abc", "abc", "abd"} {
		if err := analytics.Increment(ctx, query, windows); err != nil {
			t.Fatal(err)
		}
	}
	top, err := analytics.Top(ctx, search.WindowHour, 1)
	if err != nil || len(top) != 1 || top[0] != (search.Term{Query: "abc", Score: 2}) {
		t.Fatalf("top trends: %+v %v", top, err)
	}
	if empty, err := analytics.Top(ctx, search.WindowSixHours, 10); err != nil || len(empty) != 0 {
		t.Fatalf("windows are recorded separately: %+v %v", empty, err)
	}
	if none, err := analytics.Top(ctx, search.WindowHour, 0); err != nil || len(none) != 0 {
		t.Fatalf("limit 0: %+v %v", none, err)
	}
	if keys, _ := client.Keys(ctx, client.Key("search", "*")).Result(); len(keys) != 2 {
		t.Fatalf("keys must live under the client prefix: %v", keys)
	}

	if err := analytics.DecayTrends(ctx, windows, 0.5, 0.6); err != nil {
		t.Fatal(err)
	}
	top, _ = analytics.Top(ctx, search.WindowDay, 10)
	if len(top) != 1 || top[0].Query != "abc" || math.Abs(top[0].Score-1) > 1e-9 {
		t.Fatalf("decayed trends drop low scores: %+v", top)
	}
}
