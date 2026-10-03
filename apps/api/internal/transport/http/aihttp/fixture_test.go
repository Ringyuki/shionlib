package aihttp_test

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/aihttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

const (
	screenScene = "moderation_screen"
	reviewScene = "moderation_review"
)

var (
	member     = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin      = actor.Actor{UserID: 2, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitJustShow}
	superAdmin = actor.Actor{UserID: 3, Role: actor.RoleSuperAdmin, ContentLimit: actor.ContentLimitJustShow}
	scenes     = []ai.SceneDefinition{
		{Key: screenScene, Label: "内容审核初筛", Output: ai.OutputModeration},
		{Key: reviewScene, Label: "内容审核复审", Output: ai.OutputObject},
	}
)

type generated struct {
	completion ai.Completion
	err        error
}

type upstream struct {
	mu          sync.Mutex
	models      []ai.UpstreamModel
	listErr     error
	generations []generated
	generated   []ai.Generation
	classified  ai.Classified
	classifyErr error
}

func (u *upstream) Generate(_ context.Context, request ai.Generation) (ai.Completion, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.generated = append(u.generated, request)
	if len(u.generations) == 0 {
		return ai.Completion{Text: `{"ok": true}`, FinishReason: ai.FinishStop, Usage: ai.Usage{InputTokens: 10, OutputTokens: 5}, FirstToken: 40 * time.Millisecond}, nil
	}
	next := u.generations[0]
	u.generations = u.generations[1:]
	return next.completion, next.err
}

func (u *upstream) Classify(context.Context, ai.Classification) (ai.Classified, error) {
	return u.classified, u.classifyErr
}

func (u *upstream) ListModels(context.Context, ai.Connection) ([]ai.UpstreamModel, error) {
	return u.models, u.listErr
}

func (u *upstream) Endpoint(route ai.RouteTarget) string {
	base := "https://default.test"
	if route.Connection.BaseURL != nil {
		base = *route.Connection.BaseURL
	}
	return base + "/" + string(route.Protocol)
}

func (u *upstream) script(results ...generated) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.generations = append(u.generations, results...)
}

type catalogSource struct{}

func (catalogSource) Fetch(context.Context) (ai.Catalog, error) {
	openaiNPM, relayURL := "@ai-sdk/openai", "https://relay.test/v1"
	gpt, moderation := "openai/gpt-5-mini", "openai/omni-moderation-latest"
	window, output := 400000, 128000
	input, out := 0.25, 2.0
	return ai.Catalog{
		Providers: []ai.CatalogProvider{
			{ID: "openai", Name: "OpenAI", NPM: &openaiNPM},
			{ID: "relay", Name: "Relay", APIURL: &relayURL},
		},
		Models: []ai.CatalogModel{
			{ProviderID: "openai", ModelKey: "gpt-5-mini", CanonicalID: &gpt, Name: "GPT-5 mini", InputModalities: []string{"text", "image"}, OutputModalities: []string{"text"}, ContextLimit: &window, OutputLimit: &output, Reasoning: true, InputPrice: &input, OutputPrice: &out},
			{ProviderID: "openai", ModelKey: "omni-moderation-latest", CanonicalID: &moderation, Name: "Omni Moderation", InputModalities: []string{"text"}, OutputModalities: []string{"text"}},
			{ProviderID: "relay", ModelKey: "gpt-5-mini", CanonicalID: &gpt, Name: "GPT-5 mini (relay)", InputModalities: []string{"text"}, OutputModalities: []string{"text"}, InputPrice: &input, OutputPrice: &out},
		},
	}, nil
}

type queue struct {
	mu   sync.Mutex
	jobs []ai.Job
}

func (q *queue) Enqueue(_ context.Context, job ai.Job) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.jobs = append(q.jobs, job)
	return nil
}

func (q *queue) notices() []ai.RouteStatusNotice {
	q.mu.Lock()
	defer q.mu.Unlock()
	var notices []ai.RouteStatusNotice
	for _, job := range q.jobs {
		if notice, ok := job.(ai.RouteStatusNotice); ok {
			notices = append(notices, notice)
		}
	}
	return notices
}

type fixture struct {
	t        *testing.T
	server   *apitest.Server
	repo     *aitest.MemoryRepository
	requests *aitest.MemoryRequestLog
	stats    *aitest.Stats
	upstream *upstream
	queue    *queue
}

func setup(t *testing.T) *fixture {
	t.Helper()
	now := func() time.Time { return apitest.Now }
	calls := 0
	var mu sync.Mutex
	newID := func() string {
		mu.Lock()
		defer mu.Unlock()
		calls++
		return "call-" + strconv.Itoa(calls)
	}
	f := &fixture{
		t:        t,
		server:   apitest.New(t),
		repo:     aitest.NewMemoryRepository(now),
		stats:    aitest.NewStats(),
		upstream: &upstream{},
		queue:    &queue{},
	}
	f.requests = aitest.NewMemoryRequestLog(f.repo)
	tx := &txtest.Immediate{}
	gateway := ai.NewService(ai.Deps{Scenes: scenes, Repo: f.repo, Requests: f.requests, Upstream: f.upstream, Queue: f.queue, Now: now, NewID: newID, Options: ai.Options{IdleTimeout: time.Minute, RecordPayloads: true}})
	catalog := ai.NewCatalogService(ai.CatalogDeps{Source: catalogSource{}, Store: aitest.NewMemoryCatalogStore(), Repo: f.repo, Tx: tx, Now: now, Options: ai.CatalogOptions{StaleAfter: 20 * time.Hour, SearchLimit: 40}})
	probe := ai.NewProbeService(gateway, f.repo, f.queue, now)
	routes := ai.NewRouteService(ai.RouteDeps{Repo: f.repo, Stats: f.stats, Catalog: catalog, Probe: probe, Tx: tx, Now: now})
	providers := ai.NewProviderService(ai.ProviderDeps{Repo: f.repo, Stats: f.stats, Routes: routes, Catalog: catalog, Upstream: f.upstream, Tx: tx, Now: now})
	models := ai.NewModelService(ai.ModelDeps{Gateway: gateway, Repo: f.repo, Stats: f.stats, Routes: routes, Catalog: catalog, Tx: tx, Now: now})
	usage := ai.NewUsageService(ai.UsageDeps{Gateway: gateway, Repo: f.repo, Requests: f.requests, Stats: f.stats, Now: now, Options: ai.UsageOptions{RequestRetention: 90 * 24 * time.Hour, PayloadRetention: 7 * 24 * time.Hour, BreakdownLimit: 50, CostSeries: 5}})
	builder := f.server.Builder
	aihttp.NewProviderHandler(providers, builder).Register(f.server.API)
	aihttp.NewModelHandler(models, builder).Register(f.server.API)
	aihttp.NewRouteHandler(routes, builder).Register(f.server.API)
	aihttp.NewSceneHandler(ai.NewSceneService(gateway, f.repo, f.stats, now), builder).Register(f.server.API)
	aihttp.NewCatalogHandler(catalog, builder).Register(f.server.API)
	aihttp.NewUsageHandler(usage, builder).Register(f.server.API)
	aihttp.NewPlaygroundHandler(ai.NewPlaygroundService(gateway, f.requests, newID), builder).Register(f.server.API)
	return f
}

func (f *fixture) do(method, path string, as *actor.Actor, body any) apitest.Response {
	f.t.Helper()
	return f.server.Do(apitest.Request{Method: method, Path: path, As: as, Body: body})
}

func (f *fixture) expect(resp apitest.Response, status, code int) {
	f.t.Helper()
	f.server.Expect(resp, status, code)
}

func (f *fixture) decode(resp apitest.Response, target any) {
	f.t.Helper()
	resp.Decode(f.t, target)
}

func (f *fixture) createProvider(body map[string]any) int {
	f.t.Helper()
	resp := f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, body)
	f.expect(resp, http.StatusCreated, 0)
	var created struct {
		ID int `json:"id"`
	}
	f.decode(resp, &created)
	return created.ID
}

func (f *fixture) openAIProvider() int {
	f.t.Helper()
	return f.createProvider(map[string]any{"kind": "openai", "name": "OpenAI", "api_key": "sk-test-0123456789abcdef"})
}

func (f *fixture) syncCatalog() {
	f.t.Helper()
	f.expect(f.do(http.MethodPost, "/admin/ai/catalog/sync", &superAdmin, nil), http.StatusOK, 0)
}

func (f *fixture) addRoutes(providerID int, items ...map[string]any) []int {
	f.t.Helper()
	resp := f.do(http.MethodPost, "/admin/ai/providers/"+strconv.Itoa(providerID)+"/routes", &superAdmin, map[string]any{"items": items})
	f.expect(resp, http.StatusOK, 0)
	var result struct {
		RouteIDs []int `json:"route_ids"`
	}
	f.decode(resp, &result)
	return result.RouteIDs
}

func (f *fixture) route(id int) routeShape {
	f.t.Helper()
	resp := f.do(http.MethodGet, "/admin/ai/routes/"+strconv.Itoa(id), &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	var route routeShape
	f.decode(resp, &route)
	return route
}

type routeShape struct {
	ID    int `json:"id"`
	Model struct {
		ID         int    `json:"id"`
		Key        string `json:"key"`
		Moderation bool   `json:"moderation"`
	} `json:"model"`
	Provider struct {
		ID   int    `json:"id"`
		Kind string `json:"kind"`
	} `json:"provider"`
	UpstreamID    string   `json:"upstream_id"`
	Protocol      string   `json:"protocol"`
	InputPrice    float64  `json:"input_price"`
	Status        string   `json:"status"`
	StatusKind    *string  `json:"status_kind"`
	DroppedParams []string `json:"dropped_params"`
	Offered       *bool    `json:"offered"`
	Last          *struct {
		ID string `json:"id"`
		OK bool   `json:"ok"`
	} `json:"last"`
	Stats struct {
		Requests int `json:"requests"`
	} `json:"stats"`
}
