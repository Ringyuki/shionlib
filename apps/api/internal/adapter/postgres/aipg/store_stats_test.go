package aipg_test

import (
	"fmt"
	"math"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

var anchor = time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)

type statsFixture struct {
	stats    *aipg.StatsStore
	provider int
	first    int
	second   int
	routeA   int
	routeB   int
}

func ptr[T any](value T) *T {
	return &value
}

func near(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func newStatsFixture(t *testing.T) statsFixture {
	t.Helper()
	db, env := repositoryEnv(t)
	ctx := t.Context()
	provider, err := env.Repo.CreateProvider(ctx, ai.NewProvider{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.example/v1"), APIKey: "sk-relay-0123456789", PriceMultiplier: 1})
	if err != nil {
		t.Fatal(err)
	}
	first, err := env.Repo.CreateModel(ctx, ai.NewModel{Key: "first", Name: "First"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := env.Repo.CreateModel(ctx, ai.NewModel{Key: "second", Name: "Second"})
	if err != nil {
		t.Fatal(err)
	}
	routeA, err := env.Repo.CreateRoute(ctx, ai.NewRoute{ModelID: first, ProviderID: provider, UpstreamID: "first", Protocol: ai.ProtocolChat})
	if err != nil {
		t.Fatal(err)
	}
	routeB, err := env.Repo.CreateRoute(ctx, ai.NewRoute{ModelID: second, ProviderID: provider, UpstreamID: "second", Protocol: ai.ProtocolChat})
	if err != nil {
		t.Fatal(err)
	}
	log := aipg.NewRequestStore(db.Ent)
	review, screen := "moderation_review", "moderation_screen"
	calls := 0
	record := func(scene *string, source ai.Source, model, route int, ok bool, firstToken *time.Duration, duration time.Duration, cost float64, usage ai.Usage, at time.Duration, failure *ai.Failure) {
		t.Helper()
		calls++
		if _, err := log.Record(ctx, ai.RequestRecord{
			CallID: fmt.Sprintf("6f1d6d2e-3b9b-4c0d-9a51-%012x", calls), Source: source, Scene: scene,
			ModelID: &model, RouteID: &route, ProviderID: &provider, UpstreamID: "upstream", Protocol: ai.ProtocolChat, OK: ok,
			Failure: failure, FirstToken: firstToken, Duration: duration, Usage: usage, CostUSD: cost, Created: anchor.Add(at),
		}); err != nil {
			t.Fatal(err)
		}
	}
	ms := func(value int) *time.Duration {
		duration := time.Duration(value) * time.Millisecond
		return &duration
	}
	record(&review, ai.SourceScene, first, routeA, true, ms(100), time.Second, 0.01, ai.Usage{InputTokens: 100, OutputTokens: 10}, 5*time.Minute, nil)
	record(&review, ai.SourceScene, first, routeA, true, ms(300), 3*time.Second, 0.02, ai.Usage{InputTokens: 200, OutputTokens: 20}, 10*time.Minute, nil)
	record(&review, ai.SourceScene, first, routeA, false, nil, 5*time.Second, 0, ai.Usage{}, 70*time.Minute, &ai.Failure{Kind: ai.ErrorTimeout, Message: "slow"})
	record(&screen, ai.SourceScene, second, routeB, true, ms(50), 200*time.Millisecond, 0.001, ai.Usage{InputTokens: 5}, 20*time.Minute, nil)
	record(nil, ai.SourcePlayground, first, routeA, true, ms(10), time.Second, 1, ai.Usage{}, 30*time.Minute, nil)
	record(nil, ai.SourceCheck, second, routeB, false, nil, time.Second, 0, ai.Usage{}, 80*time.Minute, &ai.Failure{Kind: ai.ErrorAuth, Message: "bad key"})
	return statsFixture{stats: aipg.NewStatsStore(db.Ent), provider: provider, first: first, second: second, routeA: routeA, routeB: routeB}
}

func TestGroupedStatsOnlyCountSceneTraffic(t *testing.T) {
	f := newStatsFixture(t)
	byModel, err := f.stats.Grouped(t.Context(), ai.DimensionModel, anchor)
	if err != nil {
		t.Fatal(err)
	}
	first, second := byModel[strconv.Itoa(f.first)], byModel[strconv.Itoa(f.second)]
	if len(byModel) != 2 || first.Requests != 3 || first.Failures != 1 || first.FirstTokenMS == nil || *first.FirstTokenMS != 200 || !near(first.CostUSD, 0.03) ||
		second.Requests != 1 || *second.FirstTokenMS != 50 || !near(second.CostUSD, 0.001) {
		t.Fatalf("by model %+v", byModel)
	}
	byScene, err := f.stats.Grouped(t.Context(), ai.DimensionScene, anchor)
	if err != nil {
		t.Fatal(err)
	}
	if byScene["moderation_review"].Requests != 3 || byScene["moderation_screen"].Requests != 1 || len(byScene) != 2 {
		t.Fatalf("by scene %+v", byScene)
	}
	byProvider, err := f.stats.Grouped(t.Context(), ai.DimensionProvider, anchor.Add(15*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if byProvider[strconv.Itoa(f.provider)].Requests != 2 {
		t.Fatalf("by provider since a later time %+v", byProvider)
	}
	if _, err := f.stats.Grouped(t.Context(), ai.Dimension("user"), anchor); err == nil {
		t.Fatal("unknown dimensions are rejected")
	}
}

func TestLatestAttemptsAndLastUse(t *testing.T) {
	f := newStatsFixture(t)
	latest, err := f.stats.LatestAttempts(t.Context(), []int{f.routeA, f.routeB, 987654})
	if err != nil {
		t.Fatal(err)
	}
	a, b := latest[f.routeA], latest[f.routeB]
	if len(latest) != 2 || a.OK || !a.Created.Equal(anchor.Add(70*time.Minute)) || *a.ErrorKind != ai.ErrorTimeout || a.FirstTokenMS != nil ||
		b.OK || *b.ErrorKind != ai.ErrorAuth || *b.ErrorMessage != "bad key" {
		t.Fatalf("latest %+v", latest)
	}
	if empty, err := f.stats.LatestAttempts(t.Context(), nil); err != nil || len(empty) != 0 {
		t.Fatalf("no routes %v %v", empty, err)
	}
	used, err := f.stats.LastUsed(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if at := used[f.provider]; !at.Equal(anchor.Add(70 * time.Minute)) {
		t.Fatalf("last scene use %v", used)
	}
}

func TestMetricsBucketsAndCostsHonourTheFilter(t *testing.T) {
	f := newStatsFixture(t)
	scene := ai.SourceScene
	totals, err := f.stats.Metrics(t.Context(), ai.RequestFilter{Since: anchor, Source: &scene}, anchor.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if totals.Requests != 4 || totals.Failures != 1 || *totals.FirstTokenMS != 100 || !near(totals.CostUSD, 0.031) {
		t.Fatalf("scene totals %+v", totals)
	}
	firstHour, err := f.stats.Metrics(t.Context(), ai.RequestFilter{Since: anchor, ModelID: &f.first}, anchor.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if firstHour.Requests != 3 || firstHour.Failures != 0 || !near(firstHour.CostUSD, 1.03) {
		t.Fatalf("first hour of the first model %+v", firstHour)
	}
	failed := false
	none, err := f.stats.Metrics(t.Context(), ai.RequestFilter{Since: anchor, OK: &failed, ErrorKind: ptr(ai.ErrorQuota)}, anchor.Add(2*time.Hour))
	if err != nil || none.Requests != 0 || none.FirstTokenMS != nil {
		t.Fatalf("no matches %+v %v", none, err)
	}
	buckets, err := f.stats.Buckets(t.Context(), ai.RequestFilter{Since: anchor, Source: &scene}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(buckets) != 2 || !buckets[0].At.Equal(anchor) || buckets[0].Requests != 3 || *buckets[0].FirstTokenMS != 100 ||
		!buckets[1].At.Equal(anchor.Add(time.Hour)) || buckets[1].Failures != 1 || buckets[1].FirstTokenMS != nil {
		t.Fatalf("buckets %+v", buckets)
	}
	daily, err := f.stats.Buckets(t.Context(), ai.RequestFilter{Since: anchor, Source: &scene}, 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if want := time.Date(2026, 10, 2, 16, 0, 0, 0, time.UTC); len(daily) != 1 || !daily[0].At.Equal(want) || daily[0].Requests != 4 {
		t.Fatalf("days start at midnight UTC+8: %+v", daily)
	}
	costs, err := f.stats.CostBuckets(t.Context(), ai.RequestFilter{Since: anchor, Source: &scene}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(costs) != 3 || !costs[0].At.Equal(anchor) || *costs[0].ModelID != f.first || !near(costs[0].CostUSD, 0.03) ||
		*costs[1].ModelID != f.second || !near(costs[1].CostUSD, 0.001) || !costs[2].At.Equal(anchor.Add(time.Hour)) || costs[2].CostUSD != 0 {
		t.Fatalf("costs %+v", costs)
	}
}

func TestBreakdownRanksBusiestKeys(t *testing.T) {
	f := newStatsFixture(t)
	rows, err := f.stats.Breakdown(t.Context(), ai.DimensionModel, anchor, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].Key != strconv.Itoa(f.first) || rows[0].Stats.Requests != 3 || *rows[0].DurationP95 != 4800 || rows[0].InputTokens != 300 ||
		rows[0].OutputTokens != 30 || rows[1].Key != strconv.Itoa(f.second) || rows[1].InputTokens != 5 {
		t.Fatalf("breakdown %+v", rows)
	}
	limited, err := f.stats.Breakdown(t.Context(), ai.DimensionScene, anchor, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(limited) != 1 || limited[0].Key != "moderation_review" {
		t.Fatalf("limited breakdown %+v", limited)
	}
}
