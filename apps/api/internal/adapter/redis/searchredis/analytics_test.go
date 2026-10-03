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

	record := func(query string, prefixes ...string) {
		t.Helper()
		if err := analytics.Increment(ctx, query, windows, prefixes, 2); err != nil {
			t.Fatal(err)
		}
	}
	record("abc", "a", "ab", "abc")
	record("abc", "a", "ab", "abc")
	record("abd", "a", "ab", "abd")
	record("axe", "a", "ax", "axe")

	top, err := analytics.Top(ctx, search.WindowHour, 2)
	if err != nil || len(top) != 2 || top[0] != (search.Term{Query: "abc", Score: 2}) {
		t.Fatalf("top trends: %+v %v", top, err)
	}
	suggestions, err := analytics.Suggestions(ctx, "a", 10)
	if err != nil || len(suggestions) != 2 || suggestions[0].Query != "abc" {
		t.Fatalf("prefix keeps the strongest candidates only: %+v %v", suggestions, err)
	}
	if empty, err := analytics.Suggestions(ctx, "zz", 10); err != nil || len(empty) != 0 {
		t.Fatalf("unknown prefix: %+v %v", empty, err)
	}
	if keys, _ := client.Keys(ctx, client.Key("search", "*")).Result(); len(keys) == 0 {
		t.Fatal("keys must live under the client prefix")
	}

	if err := analytics.DecayTrends(ctx, windows, 0.5, 0.6); err != nil {
		t.Fatal(err)
	}
	top, _ = analytics.Top(ctx, search.WindowHour, 10)
	if len(top) != 1 || top[0].Query != "abc" || math.Abs(top[0].Score-1) > 1e-9 {
		t.Fatalf("decayed trends drop low scores: %+v", top)
	}
	if err := analytics.DecaySuggestions(ctx, 0.5, 0.6); err != nil {
		t.Fatal(err)
	}
	suggestions, _ = analytics.Suggestions(ctx, "ab", 10)
	if len(suggestions) != 1 || math.Abs(suggestions[0].Score-1) > 1e-9 {
		t.Fatalf("decayed suggestions: %+v", suggestions)
	}

	for _, query := range []string{"q1", "q2", "q3"} {
		if err := analytics.Increment(ctx, query, nil, []string{"q"}, 10); err != nil {
			t.Fatal(err)
		}
	}
	if err := analytics.TrimSuggestions(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if trimmed, _ := analytics.Suggestions(ctx, "q", 10); len(trimmed) != 1 {
		t.Fatalf("trim keeps the configured number of candidates: %+v", trimmed)
	}
}
