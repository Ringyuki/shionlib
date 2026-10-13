package ai_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestOverviewComparesWithThePreviousWindow(t *testing.T) {
	f := newFixture(t)
	f.stats.Totals = ai.Stats{Requests: 3, CostUSD: 1.5}
	overview := must(f.usage.Overview(t.Context(), ai.RangeDay))
	if overview.Current.Requests != 3 || len(f.stats.Filters) != 2 {
		t.Fatalf("overview %+v filters %+v", overview, f.stats.Filters)
	}
	current, previous := f.stats.Filters[0], f.stats.Filters[1]
	if *current.Source != ai.SourceScene || !current.Since.Equal(f.clock.Now().Add(-24*time.Hour)) || !previous.Since.Equal(f.clock.Now().Add(-48*time.Hour)) {
		t.Fatalf("filters %+v %+v", current, previous)
	}
}

func TestCostsKeepTheTopModelsAndGroupTheRest(t *testing.T) {
	f := newFixture(t)
	a, b, c := f.model(t, "a", ai.Capabilities{}), f.model(t, "b", ai.Capabilities{}), f.model(t, "c", ai.Capabilities{})
	first, count := ai.RangeDay.Window(f.clock.Now())
	last := first.Add(time.Duration(count-1) * time.Hour)
	f.stats.Costs = []ai.CostBucket{
		{At: first, ModelID: &a, CostUSD: 5},
		{At: last, ModelID: &b, CostUSD: 3},
		{At: last, ModelID: &c, CostUSD: 1},
		{At: last, CostUSD: 0.5},
	}
	costs := must(f.usage.Costs(t.Context(), ai.RangeDay, nil, nil))
	if len(costs.Buckets) != 24 || len(costs.Models) != 3 {
		t.Fatalf("costs %+v", costs)
	}
	if *costs.Models[0].ModelID != a || costs.Models[0].Costs[0] != 5 || *costs.Models[1].Label != "b" || costs.Models[2].ModelID != nil || costs.Models[2].Costs[23] != 1.5 {
		t.Fatalf("models %+v", costs.Models)
	}
}

func TestBreakdownLabels(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	f.stats.Rows = []ai.BreakdownRow{{Key: itoa(setup.modelID), Stats: ai.Stats{Requests: 2}}, {Key: "999"}}
	rows := must(f.usage.Breakdown(t.Context(), ai.RangeWeek, ai.DimensionModel))
	if rows[0].Label != "gpt-test" || len(rows[0].Routes) != 2 || rows[0].Routes[0] != "alpha" || rows[1].Label != "999" || rows[1].Routes == nil {
		t.Fatalf("rows %+v", rows)
	}
	f.stats.Rows = []ai.BreakdownRow{{Key: textScene}}
	if rows := must(f.usage.Breakdown(t.Context(), ai.RangeWeek, ai.DimensionScene)); rows[0].Label != "Chat" {
		t.Fatalf("scene rows %+v", rows)
	}
}

func TestRequestLogsSummariesAndPurge(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	f.upstream.script(setup.primary, step{err: &ai.Failure{Kind: ai.ErrorUpstream, Message: "HTTP 500", Detail: "500 body"}})
	if _, err := f.gateway.Text(t.Context(), textScene, ai.TextRequest{Prompt: ai.UserPrompt("", "hi")}); err != nil {
		t.Fatal(err)
	}
	requests, total := must2(f.usage.Requests(t.Context(), ai.RequestQuery{Range: ai.RangeDay}, ai.Page{Number: 1, Size: 10}))
	if total != 2 || len(requests) != 2 {
		t.Fatalf("requests %+v", requests)
	}
	detail := must(f.usage.Request(t.Context(), requests[1].ID))
	if len(detail.Attempts) != 2 || detail.ErrorDetail == nil || *detail.ErrorDetail != "500 body" {
		t.Fatalf("detail %+v", detail)
	}
	summary := must(f.usage.Summary(t.Context(), ai.RequestQuery{Range: ai.RangeHour}))
	if len(summary.Buckets) != 12 || summary.Bucket != 5*time.Minute {
		t.Fatalf("summary %+v", summary)
	}
	f.clock.Advance(8 * 24 * time.Hour)
	if err := f.usage.Purge(t.Context()); err != nil {
		t.Fatal(err)
	}
	detail = must(f.usage.Request(t.Context(), requests[0].ID))
	if detail.Payload != nil {
		t.Fatalf("payloads expire first: %+v", detail.Payload)
	}
	f.clock.Advance(90 * 24 * time.Hour)
	if err := f.usage.Purge(t.Context()); err != nil {
		t.Fatal(err)
	}
	if _, total := must2(f.usage.Requests(t.Context(), ai.RequestQuery{Range: ai.RangeMonth}, ai.Page{Number: 1, Size: 10})); total != 0 {
		t.Fatalf("requests expire: %d", total)
	}
}
