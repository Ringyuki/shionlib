package ai_test

import (
	"context"
	"encoding/json"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai/aitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

const (
	objectScene     = "review"
	textScene       = "chat"
	moderationScene = "screen"
)

var scenes = []ai.SceneDefinition{
	{Key: objectScene, Label: "Review", Output: ai.OutputObject},
	{Key: textScene, Label: "Chat", Output: ai.OutputText},
	{Key: moderationScene, Label: "Screen", Output: ai.OutputModeration},
}

type step struct {
	completion ai.Completion
	err        error
}

type upstream struct {
	mu          sync.Mutex
	steps       map[int][]step
	generations []ai.Generation
	classified  ai.Classified
	classifyErr error
	models      []ai.UpstreamModel
	listErr     error
	connections []ai.Connection
}

func (u *upstream) script(routeID int, steps ...step) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.steps[routeID] = append(u.steps[routeID], steps...)
}

func (u *upstream) Generate(_ context.Context, request ai.Generation) (ai.Completion, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.generations = append(u.generations, request)
	queue := u.steps[request.Route.ID]
	if len(queue) == 0 {
		return ai.Completion{Text: `{"ok":true}`, FinishReason: ai.FinishStop, Usage: ai.Usage{InputTokens: 10, OutputTokens: 2}, FirstToken: 5 * time.Millisecond}, nil
	}
	next := queue[0]
	u.steps[request.Route.ID] = queue[1:]
	return next.completion, next.err
}

func (u *upstream) Classify(_ context.Context, request ai.Classification) (ai.Classified, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	queue := u.steps[request.Route.ID]
	if len(queue) > 0 {
		next := queue[0]
		u.steps[request.Route.ID] = queue[1:]
		if next.err != nil {
			return ai.Classified{}, next.err
		}
	}
	return u.classified, u.classifyErr
}

func (u *upstream) ListModels(_ context.Context, connection ai.Connection) ([]ai.UpstreamModel, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.connections = append(u.connections, connection)
	return u.models, u.listErr
}

func (u *upstream) Endpoint(route ai.RouteTarget) string {
	base := "https://default.test"
	if route.Connection.BaseURL != nil {
		base = *route.Connection.BaseURL
	}
	return base + "/" + string(route.Protocol)
}

func (u *upstream) calls() []ai.Generation {
	u.mu.Lock()
	defer u.mu.Unlock()
	return append([]ai.Generation{}, u.generations...)
}

type source struct {
	catalog ai.Catalog
	err     error
}

func (s *source) Fetch(context.Context) (ai.Catalog, error) {
	return s.catalog, s.err
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
	var out []ai.RouteStatusNotice
	for _, job := range q.jobs {
		if notice, ok := job.(ai.RouteStatusNotice); ok {
			out = append(out, notice)
		}
	}
	return out
}

type messenger struct {
	sent []message.NewMessage
}

func (m *messenger) Send(_ context.Context, in message.NewMessage) error {
	m.sent = append(m.sent, in)
	return nil
}

type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

type fixture struct {
	clock      *clock
	repo       *aitest.MemoryRepository
	requests   *aitest.MemoryRequestLog
	catalogs   *aitest.MemoryCatalogStore
	stats      *aitest.Stats
	upstream   *upstream
	source     *source
	queue      *queue
	messenger  *messenger
	gateway    *ai.Service
	catalog    *ai.CatalogService
	probe      *ai.ProbeService
	routes     *ai.RouteService
	providers  *ai.ProviderService
	models     *ai.ModelService
	scenes     *ai.SceneService
	usage      *ai.UsageService
	playground *ai.PlaygroundService
	notices    *ai.NoticeService
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{
		clock:     &clock{now: time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)},
		catalogs:  aitest.NewMemoryCatalogStore(),
		stats:     aitest.NewStats(),
		upstream:  &upstream{steps: map[int][]step{}},
		source:    &source{},
		queue:     &queue{},
		messenger: &messenger{},
	}
	f.repo = aitest.NewMemoryRepository(f.clock.Now)
	f.requests = aitest.NewMemoryRequestLog(f.repo)
	ids := 0
	var idMu sync.Mutex
	newID := func() string {
		idMu.Lock()
		defer idMu.Unlock()
		ids++
		return "call-" + strconv.Itoa(ids)
	}
	tx := &txtest.Immediate{}
	f.gateway = ai.NewService(ai.Deps{Scenes: scenes, Repo: f.repo, Requests: f.requests, Upstream: f.upstream, Queue: f.queue, Now: f.clock.Now, NewID: newID, Options: ai.Options{IdleTimeout: time.Minute, RecordPayloads: true}})
	f.catalog = ai.NewCatalogService(ai.CatalogDeps{Source: f.source, Store: f.catalogs, Repo: f.repo, Tx: tx, Now: f.clock.Now, Options: ai.CatalogOptions{StaleAfter: 20 * time.Hour, SearchLimit: 40}})
	f.probe = ai.NewProbeService(f.gateway, f.repo, f.queue, f.clock.Now)
	f.routes = ai.NewRouteService(ai.RouteDeps{Repo: f.repo, Stats: f.stats, Catalog: f.catalog, Probe: f.probe, Tx: tx, Now: f.clock.Now})
	f.providers = ai.NewProviderService(ai.ProviderDeps{Repo: f.repo, Stats: f.stats, Routes: f.routes, Catalog: f.catalog, Upstream: f.upstream, Tx: tx, Now: f.clock.Now})
	f.models = ai.NewModelService(ai.ModelDeps{Gateway: f.gateway, Repo: f.repo, Stats: f.stats, Routes: f.routes, Catalog: f.catalog, Tx: tx, Now: f.clock.Now})
	f.scenes = ai.NewSceneService(f.gateway, f.repo, f.stats, f.clock.Now)
	f.usage = ai.NewUsageService(ai.UsageDeps{Gateway: f.gateway, Repo: f.repo, Requests: f.requests, Stats: f.stats, Now: f.clock.Now, Options: ai.UsageOptions{RequestRetention: 90 * 24 * time.Hour, PayloadRetention: 7 * 24 * time.Hour, BreakdownLimit: 50, CostSeries: 2}})
	f.playground = ai.NewPlaygroundService(f.gateway, f.requests, newID)
	f.notices = ai.NewNoticeService(f.repo, f.messenger)
	return f
}

func ptr[T any](value T) *T {
	return &value
}

func must[T any](value T, err error) T {
	if err != nil {
		panic(err)
	}
	return value
}

func (f *fixture) provider(t *testing.T, name string, kind ai.ProviderKind) int {
	t.Helper()
	in := ai.NewProvider{Name: name, Kind: kind, APIKey: "sk-" + name + "-secret-key", PriceMultiplier: 1}
	if kind == ai.KindCompatible {
		in.BaseURL = ptr("https://" + name + ".test/v1")
	}
	return must(f.repo.CreateProvider(t.Context(), in))
}

func (f *fixture) model(t *testing.T, key string, capabilities ai.Capabilities) int {
	t.Helper()
	return must(f.repo.CreateModel(t.Context(), ai.NewModel{Key: key, Name: key, Capabilities: capabilities}))
}

func (f *fixture) route(t *testing.T, modelID, providerID int, protocol ai.Protocol, priority int) int {
	t.Helper()
	return must(f.repo.CreateRoute(t.Context(), ai.NewRoute{ModelID: modelID, ProviderID: providerID, UpstreamID: "upstream-" + strconv.Itoa(modelID), Protocol: protocol, Price: ai.Price{Input: 1, Output: 2}, Priority: priority}))
}

func (f *fixture) assign(t *testing.T, scene string, modelID int) {
	t.Helper()
	if err := f.repo.SaveSceneConfig(t.Context(), ai.SceneConfig{Key: scene, ModelID: &modelID}); err != nil {
		t.Fatal(err)
	}
}

type gatewaySetup struct {
	modelID int
	primary int
	backup  int
}

func (f *fixture) twoRoutes(t *testing.T, scene string) gatewaySetup {
	t.Helper()
	first := f.provider(t, "alpha", ai.KindCompatible)
	second := f.provider(t, "beta", ai.KindCompatible)
	modelID := f.model(t, "gpt-test", ai.Capabilities{Temperature: true, OutputLimit: ptr(4000)})
	setup := gatewaySetup{modelID: modelID, primary: f.route(t, modelID, first, ai.ProtocolChat, 0), backup: f.route(t, modelID, second, ai.ProtocolChat, 1)}
	f.assign(t, scene, modelID)
	return setup
}

var objectSchema = json.RawMessage(`{"type":"object","properties":{"ok":{"type":"boolean"}}}`)

func objectRequest() ai.ObjectRequest {
	return ai.ObjectRequest{Prompt: ai.UserPrompt("system", "input"), Schema: objectSchema, SchemaName: "result"}
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func sampleCatalog() ai.Catalog {
	return ai.Catalog{
		Providers: []ai.CatalogProvider{
			{ID: "openai", Name: "OpenAI", NPM: ptr("@ai-sdk/openai")},
			{ID: "anthropic", Name: "Anthropic", NPM: ptr("@ai-sdk/anthropic")},
			{ID: "relay", Name: "Relay", NPM: ptr("@ai-sdk/openai-compatible"), APIURL: ptr("https://relay.test/v1")},
		},
		Models: []ai.CatalogModel{
			{ProviderID: "openai", ModelKey: "gpt-5-mini", CanonicalID: ptr("openai/gpt-5-mini"), Name: "GPT-5 mini", NPM: ptr("@ai-sdk/openai"), InputModalities: []string{"text", "image"}, OutputModalities: []string{"text"}, Temperature: false, Reasoning: true, OutputLimit: ptr(128000), InputPrice: ptr(0.25), OutputPrice: ptr(2.0), CacheReadPrice: ptr(0.025)},
			{ProviderID: "relay", ModelKey: "gpt-5-mini", CanonicalID: ptr("openai/gpt-5-mini"), Name: "GPT-5 mini", InputModalities: []string{"text"}, OutputModalities: []string{"text"}, Temperature: true, InputPrice: ptr(0.3), OutputPrice: ptr(2.4)},
			{ProviderID: "openai", ModelKey: "omni-moderation-latest", CanonicalID: ptr("openai/omni-moderation-latest"), Name: "Omni moderation", InputModalities: []string{"text"}, OutputModalities: []string{"text"}, Temperature: true},
			{ProviderID: "anthropic", ModelKey: "claude-sonnet-4", CanonicalID: ptr("anthropic/claude-sonnet-4"), Name: "Claude Sonnet 4", NPM: ptr("@ai-sdk/anthropic"), InputModalities: []string{"text", "image"}, OutputModalities: []string{"text"}, Temperature: true, InputPrice: ptr(3.0), OutputPrice: ptr(15.0)},
			{ProviderID: "openai", ModelKey: "gpt-image-1", CanonicalID: ptr("openai/gpt-image-1"), Name: "GPT Image", InputModalities: []string{"text"}, OutputModalities: []string{"image"}},
		},
	}
}

func (f *fixture) syncCatalog(t *testing.T) {
	t.Helper()
	f.source.catalog = sampleCatalog()
	if _, err := f.catalog.Sync(t.Context()); err != nil {
		t.Fatal(err)
	}
}

func must2[A, B any](a A, b B, err error) (A, B) {
	if err != nil {
		panic(err)
	}
	return a, b
}
