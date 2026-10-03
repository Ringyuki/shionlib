package admin_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
)

func TestOverviewUsesTheUTC8DayAndCaches(t *testing.T) {
	store := admintest.NewStatsStore(admin.Overview{TotalGames: 3, TotalDownloads: 1 << 40}, admin.DailyCounts{})
	cache := admintest.NewCache()
	service := admin.NewStatsService(store, cache, clock)
	ctx := context.Background()
	first, err := service.Overview(ctx)
	if err != nil || first.TotalGames != 3 || first.TotalDownloads != 1<<40 {
		t.Fatalf("overview: %+v %v", first, err)
	}
	second, err := service.Overview(ctx)
	if err != nil || second != first {
		t.Fatalf("cached overview: %+v %v", second, err)
	}
	since, _ := store.Calls()
	if len(since) != 1 || !since[0].Equal(time.Date(2026, 2, 17, 16, 0, 0, 0, time.UTC)) {
		t.Fatalf("one store call since midnight UTC+8: %v", since)
	}
	if ttl, ok := cache.TTL("admin:stats:overview"); !ok || ttl != 5*time.Minute {
		t.Fatalf("ttl: %v %v", ttl, ok)
	}
}

func TestTrendsAreZeroFilledOldestFirst(t *testing.T) {
	store := admintest.NewStatsStore(admin.Overview{}, admin.DailyCounts{Games: map[string]int{"2026-02-17": 2}, Users: map[string]int{"2026-02-18": 3}})
	cache := admintest.NewCache()
	service := admin.NewStatsService(store, cache, clock)
	points, err := service.Trends(context.Background(), 3)
	if err != nil {
		t.Fatal(err)
	}
	want := []admin.TrendPoint{{Date: "2026-02-16"}, {Date: "2026-02-17", Games: 2}, {Date: "2026-02-18", Users: 3}}
	if !slices.Equal(points, want) {
		t.Fatalf("points: %+v", points)
	}
	since, offset := store.Calls()
	if !since[0].Equal(time.Date(2026, 2, 15, 16, 0, 0, 0, time.UTC)) || offset != 8*time.Hour {
		t.Fatalf("query window: %v %v", since, offset)
	}
	if ttl, ok := cache.TTL("admin:stats:trends:3"); !ok || ttl != 5*time.Minute {
		t.Fatalf("ttl: %v %v", ttl, ok)
	}
	if again, _ := service.Trends(context.Background(), 3); !slices.Equal(again, want) {
		t.Fatalf("cached: %+v", again)
	}
	if since, _ = store.Calls(); len(since) != 1 {
		t.Fatalf("cache hit skips the store: %v", since)
	}
	defaults, _ := service.Trends(context.Background(), 0)
	if len(defaults) != admin.DefaultTrendDays || defaults[len(defaults)-1].Date != "2026-02-18" {
		t.Fatalf("default window: %d %+v", len(defaults), defaults[len(defaults)-1])
	}
}
