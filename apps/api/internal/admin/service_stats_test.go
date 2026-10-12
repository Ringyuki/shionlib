package admin_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin/admintest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestOverviewUsesTheUTC8DayAndCaches(t *testing.T) {
	store := admintest.NewStatsStore(admin.Overview{TotalGames: 3, TotalDownloads: 1 << 40}, admin.DailyCounts{})
	cache := admintest.NewCache()
	service := admin.NewStatsService(admin.StatsDeps{Store: store, Cache: cache, Spool: admintest.Spool{}, AI: admintest.AIGateway(0), Settings: settingtest.Source{}, Now: clock})
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
	store := admintest.NewStatsStore(admin.Overview{}, admin.DailyCounts{
		Games:     map[string]int{"2026-02-17": 2},
		Users:     map[string]int{"2026-02-18": 3},
		Downloads: map[string]int{"2026-02-16": 40, "2026-02-18": 7},
		Views:     map[string]int{"2026-02-18": 90},
	})
	cache := admintest.NewCache()
	service := admin.NewStatsService(admin.StatsDeps{Store: store, Cache: cache, Spool: admintest.Spool{}, AI: admintest.AIGateway(0), Settings: settingtest.Source{}, Now: clock})
	points, err := service.Trends(context.Background(), 3)
	if err != nil {
		t.Fatal(err)
	}
	want := []admin.TrendPoint{{Date: "2026-02-16", Downloads: 40}, {Date: "2026-02-17", Games: 2}, {Date: "2026-02-18", Users: 3, Downloads: 7, Views: 90}}
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

func TestPendingIsReadEveryTime(t *testing.T) {
	store := admintest.NewStatsStore(admin.Overview{}, admin.DailyCounts{})
	service := admin.NewStatsService(admin.StatsDeps{Store: store, Cache: admintest.NewCache(), Spool: admintest.Spool{}, AI: admintest.AIGateway(4), Settings: settingtest.Source{}, Now: clock})
	store.Seed(admin.Pending{Reports: 2, Comments: 9}, admin.FileCounts{})
	first, err := service.Pending(context.Background())
	if err != nil || first != (admin.Pending{Reports: 2, Comments: 9, AIAlerts: 4}) {
		t.Fatalf("pending: %+v %v", first, err)
	}
	store.Seed(admin.Pending{Reports: 1}, admin.FileCounts{})
	if second, _ := service.Pending(context.Background()); second != (admin.Pending{Reports: 1, AIAlerts: 4}) {
		t.Fatalf("a handled report leaves the count at once: %+v", second)
	}
}

func TestStorageJoinsTheVolumeTheFilesAndTheReserve(t *testing.T) {
	store := admintest.NewStatsStore(admin.Overview{}, admin.DailyCounts{})
	files := admin.FileCounts{Uploading: admin.Tally{Files: 3, Bytes: 12 << 30}, AwaitingCheck: 1, Stored: admin.Tally{Files: 7395, Bytes: 14 << 40}}
	store.Seed(admin.Pending{}, files)
	settings := settingtest.Source{}
	settingtest.Set(settings, upload.SpoolReserve, 5<<30)
	service := admin.NewStatsService(admin.StatsDeps{Store: store, Cache: admintest.NewCache(), Spool: admintest.Spool{Total: 120 << 30, Free: 79 << 30}, AI: admintest.AIGateway(0), Settings: settings, Now: clock})
	storage, err := service.Storage(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := admin.Storage{FileCounts: files, SpoolCapacity: 120 << 30, SpoolAvailable: 79 << 30, SpoolReserve: 5 << 30}
	if storage != want {
		t.Fatalf("storage\n got %+v\nwant %+v", storage, want)
	}
}

func TestStatsDayIsTheDayInUTC8(t *testing.T) {
	if got := admin.StatsDay(time.Date(2026, 2, 17, 15, 59, 0, 0, time.UTC)); got != "2026-02-17" {
		t.Fatalf("before midnight UTC+8: %s", got)
	}
	if got := admin.StatsDay(time.Date(2026, 2, 17, 16, 0, 0, 0, time.UTC)); got != "2026-02-18" {
		t.Fatalf("at midnight UTC+8: %s", got)
	}
}
