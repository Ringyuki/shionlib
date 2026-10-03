package aihttp_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestOverviewReportsSceneUsage(t *testing.T) {
	f := setup(t)
	first := 900
	f.stats.Totals = ai.Stats{Requests: 12, Failures: 2, FirstTokenMS: &first, CostUSD: 0.5}
	f.expect(f.do(http.MethodGet, "/admin/ai/overview", &member, nil), http.StatusForbidden, http.StatusForbidden)
	resp := f.do(http.MethodGet, "/admin/ai/overview?range=7d", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"current":{"requests":12,"failures":2,"first_token_ms":900,"cost_usd":0.5},"previous":{"requests":12,"failures":2,"first_token_ms":900,"cost_usd":0.5}}` {
		t.Fatalf("overview %s", resp.Data)
	}
	if len(f.stats.Filters) != 2 || f.stats.Filters[0].Source == nil || *f.stats.Filters[0].Source != ai.SourceScene ||
		!f.stats.Filters[0].Since.Equal(time.Date(2026, 9, 26, 1, 2, 3, 0, time.UTC)) || !f.stats.Filters[1].Since.Equal(time.Date(2026, 9, 19, 1, 2, 3, 0, time.UTC)) {
		t.Fatalf("filters %+v", f.stats.Filters)
	}
	f.expect(f.do(http.MethodGet, "/admin/ai/overview?range=1y", &admin, nil), http.StatusUnprocessableEntity, 100101)
}

func TestCostsSeriesByModel(t *testing.T) {
	f := setup(t)
	model := f.route(f.gptRoute()).Model.ID
	latest := time.Date(2026, 10, 3, 1, 0, 0, 0, time.UTC)
	firstToken := 120
	f.stats.SeriesBuckets = []ai.SeriesBucket{{At: latest, Requests: 4, Failures: 1, CostUSD: 0.6, FirstTokenMS: &firstToken}}
	f.stats.Costs = []ai.CostBucket{{At: latest, ModelID: &model, CostUSD: 0.5}, {At: latest, CostUSD: 0.1}}
	resp := f.do(http.MethodGet, fmt.Sprintf("/admin/ai/overview/costs?model_id=%d", model), &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	var series struct {
		BucketMS int64 `json:"bucket_ms"`
		Buckets  []struct {
			At           time.Time `json:"at"`
			Requests     int       `json:"requests"`
			FirstTokenMS *int      `json:"first_token_ms"`
		} `json:"buckets"`
		Models []struct {
			ModelID *int      `json:"model_id"`
			Label   *string   `json:"label"`
			Costs   []float64 `json:"costs"`
		} `json:"models"`
	}
	f.decode(resp, &series)
	if series.BucketMS != 3600000 || len(series.Buckets) != 24 || !series.Buckets[0].At.Equal(time.Date(2026, 10, 2, 2, 0, 0, 0, time.UTC)) ||
		!series.Buckets[23].At.Equal(latest) || series.Buckets[23].Requests != 4 || series.Buckets[23].FirstTokenMS == nil || series.Buckets[0].Requests != 0 {
		t.Fatalf("buckets %s", resp.Data)
	}
	if len(series.Models) != 2 || series.Models[0].ModelID == nil || *series.Models[0].ModelID != model || *series.Models[0].Label != "GPT-5 mini" || series.Models[0].Costs[23] != 0.5 ||
		series.Models[1].ModelID != nil || series.Models[1].Label != nil || series.Models[1].Costs[23] != 0.1 || len(series.Models[1].Costs) != 24 {
		t.Fatalf("models %s", resp.Data)
	}
	last := f.stats.Filters[len(f.stats.Filters)-1]
	if last.ModelID == nil || *last.ModelID != model || last.ProviderID != nil || last.Source == nil || *last.Source != ai.SourceScene {
		t.Fatalf("filter %+v", last)
	}
}

func TestBreakdownLabelsRows(t *testing.T) {
	f := setup(t)
	model := f.route(f.gptRoute()).Model.ID
	p95 := 2400
	f.stats.Rows = []ai.BreakdownRow{{Key: fmt.Sprint(model), Stats: ai.Stats{Requests: 9, Failures: 1, CostUSD: 0.3}, DurationP95: &p95, InputTokens: 900, OutputTokens: 300}}
	resp := f.do(http.MethodGet, "/admin/ai/overview/breakdown?by=model&range=30d", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	want := fmt.Sprintf(`[{"key":"%d","label":"GPT-5 mini","routes":["OpenAI"],"requests":9,"failures":1,"first_token_ms":null,"cost_usd":0.3,"duration_p95_ms":2400,"input_tokens":900,"output_tokens":300}]`, model)
	if string(resp.Data) != want {
		t.Fatalf("breakdown %s", resp.Data)
	}
	f.stats.Rows = []ai.BreakdownRow{{Key: reviewScene, Stats: ai.Stats{Requests: 1}}}
	scenes := f.do(http.MethodGet, "/admin/ai/overview/breakdown?by=scene", &admin, nil)
	f.expect(scenes, http.StatusOK, 0)
	if !strings.Contains(string(scenes.Data), `"label":"内容审核复审","routes":[]`) {
		t.Fatalf("scene breakdown %s", scenes.Data)
	}
	f.expect(f.do(http.MethodGet, "/admin/ai/overview/breakdown?by=user", &admin, nil), http.StatusUnprocessableEntity, 100101)
}

func TestRequestLog(t *testing.T) {
	f := setup(t)
	route := f.gptRoute()
	f.upstream.script(generated{err: &ai.Failure{Kind: ai.ErrorRateLimit, Message: "HTTP 429", Detail: "429 https://api.openai.com/v1/responses\nslow down"}})
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", route), &superAdmin, nil), http.StatusOK, 0)
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/routes/%d/checks", route), &superAdmin, nil), http.StatusOK, 0)
	list := f.do(http.MethodGet, "/admin/ai/requests?source=check&pageSize=1", &admin, nil)
	f.expect(list, http.StatusOK, 0)
	var page struct {
		Items []struct {
			ID         string  `json:"id"`
			CallID     string  `json:"call_id"`
			Source     string  `json:"source"`
			RouteID    *int    `json:"route_id"`
			OK         bool    `json:"ok"`
			ErrorKind  *string `json:"error_kind"`
			DurationMS int     `json:"duration_ms"`
			Model      *struct {
				Name string `json:"name"`
			} `json:"model"`
			Provider *struct {
				Name string `json:"name"`
			} `json:"provider"`
		} `json:"items"`
		Meta struct {
			TotalItems int `json:"totalItems"`
		} `json:"meta"`
	}
	f.decode(list, &page)
	if page.Meta.TotalItems != 2 || len(page.Items) != 1 || page.Items[0].ID != "2" || !page.Items[0].OK || page.Items[0].Model == nil || page.Items[0].Model.Name != "GPT-5 mini" || page.Items[0].Provider == nil || page.Items[0].Provider.Name != "OpenAI" {
		t.Fatalf("list %s", list.Data)
	}
	failed := f.do(http.MethodGet, "/admin/ai/requests?ok=false&error_kind=rate_limit", &admin, nil)
	f.expect(failed, http.StatusOK, 0)
	if !strings.Contains(string(failed.Data), `"id":"1"`) || !strings.Contains(string(failed.Data), `"totalItems":1`) {
		t.Fatalf("filtered %s", failed.Data)
	}
	detail := f.do(http.MethodGet, "/admin/ai/requests/1", &admin, nil)
	f.expect(detail, http.StatusOK, 0)
	var request struct {
		ID           string  `json:"id"`
		OK           bool    `json:"ok"`
		ErrorKind    *string `json:"error_kind"`
		ErrorMessage *string `json:"error_message"`
		ErrorDetail  *string `json:"error_detail"`
		Payload      *struct {
			System   string `json:"system"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Schema map[string]any `json:"schema"`
			Output *string        `json:"output"`
		} `json:"payload"`
		Attempts []struct {
			ID string `json:"id"`
		} `json:"attempts"`
	}
	f.decode(detail, &request)
	if request.ID != "1" || request.OK || request.ErrorKind == nil || *request.ErrorKind != "rate_limit" || request.ErrorMessage == nil || *request.ErrorMessage != "HTTP 429" ||
		request.ErrorDetail == nil || !strings.Contains(*request.ErrorDetail, "slow down") || len(request.Attempts) != 1 || request.Attempts[0].ID != "1" {
		t.Fatalf("detail %s", detail.Data)
	}
	if request.Payload == nil || len(request.Payload.Messages) != 1 || request.Payload.Messages[0].Role != "user" || request.Payload.Schema["type"] != "object" || request.Payload.Output != nil {
		t.Fatalf("payload %s", detail.Data)
	}
	succeeded := f.do(http.MethodGet, "/admin/ai/requests/2", &admin, nil)
	f.expect(succeeded, http.StatusOK, 0)
	if !strings.Contains(string(succeeded.Data), `"output":"{\"ok\": true}"`) || !strings.Contains(string(succeeded.Data), `"finish_reason":"stop"`) {
		t.Fatalf("succeeded %s", succeeded.Data)
	}
	f.expect(f.do(http.MethodGet, "/admin/ai/requests/99", &admin, nil), http.StatusNotFound, 630119)
	f.expect(f.do(http.MethodGet, "/admin/ai/requests/abc", &admin, nil), http.StatusUnprocessableEntity, 100101)
}

func TestRequestSummary(t *testing.T) {
	f := setup(t)
	f.stats.Totals = ai.Stats{Requests: 3, Failures: 1, CostUSD: 0.01}
	resp := f.do(http.MethodGet, "/admin/ai/requests/summary?range=1h&scene="+reviewScene+"&source=scene", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	var summary struct {
		Stats struct {
			Requests int `json:"requests"`
		} `json:"stats"`
		BucketMS int64 `json:"bucket_ms"`
		Buckets  []struct {
			At time.Time `json:"at"`
		} `json:"buckets"`
	}
	f.decode(resp, &summary)
	if summary.Stats.Requests != 3 || summary.BucketMS != 300000 || len(summary.Buckets) != 12 || !summary.Buckets[11].At.Equal(time.Date(2026, 10, 3, 1, 0, 0, 0, time.UTC)) {
		t.Fatalf("summary %s", resp.Data)
	}
	metrics := f.stats.Filters[0]
	if metrics.Scene == nil || *metrics.Scene != reviewScene || metrics.Source == nil || *metrics.Source != ai.SourceScene || !metrics.Since.Equal(time.Date(2026, 10, 3, 0, 2, 3, 0, time.UTC)) {
		t.Fatalf("metrics filter %+v", metrics)
	}
}
