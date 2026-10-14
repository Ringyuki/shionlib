package apikeyredis_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/apikeyredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestCountsAreKeptPerKeyAndDay(t *testing.T) {
	counter := apikeyredis.NewCounter(redistest.New(t))
	ctx := context.Background()
	today := time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
	for _, use := range []struct {
		key       int
		day       time.Time
		throttled bool
	}{{7, today, false}, {7, today, false}, {7, today, true}, {8, today, false}, {7, today.AddDate(0, 0, -1), false}} {
		if err := counter.Count(ctx, use.key, use.day, use.throttled); err != nil {
			t.Fatal(err)
		}
	}
	counts, err := counter.Counts(ctx, today)
	if err != nil {
		t.Fatal(err)
	}
	if len(counts) != 2 || counts[0].KeyID != 7 || counts[0].Requests != 2 || counts[0].Throttled != 1 || counts[1].KeyID != 8 || counts[1].Requests != 1 || !counts[0].Day.Equal(today) {
		t.Fatalf("unexpected counts %+v", counts)
	}
	if none, err := counter.Counts(ctx, today.AddDate(0, 0, 1)); err != nil || len(none) != 0 {
		t.Fatalf("a day without use: %+v %v", none, err)
	}
}
