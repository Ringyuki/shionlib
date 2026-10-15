package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aiwalkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	e2eGatewayModel    = "gpt-5-mini"
	e2eGatewayScreen   = "omni-moderation-latest"
	e2eOfferedModel    = "claude-haiku-4-5"
	e2eReviewCanonical = "openai/gpt-5-mini"
	e2eScreenCanonical = "openai/omni-moderation-latest"
	e2eOfferCanonical  = "anthropic/claude-haiku-4-5"
	e2eBackupProvider  = "e2e-backup"
	e2eQuotaMessage    = "402 Insufficient credits"
	e2eReviewCall      = "e2e0c411-0000-4000-8000-000000000001"
	e2eReviewOutput    = `{"decision":"REVIEW","category":"HARASSMENT","score":0.64,"reason":"Seeded review output."}`
)

type e2eAIGateway struct {
	primary     int
	backup      int
	reviewModel int
	screenModel int
	reviewRoute int
	backupRoute int
	screenRoute int
	seededAt    time.Time
	requests    *aipg.RequestStore
	repo        *aipg.Repository
	reviewScene string
	screenScene string
	formatScene string
}

func e2eCatalog() ai.Catalog {
	openai, anthropic, text, image := "@ai-sdk/openai", "@ai-sdk/anthropic", "text", "image"
	router := "https://openrouter.ai/api/v1"
	moderation := "moderation"
	review, screen, offered := e2eReviewCanonical, e2eScreenCanonical, e2eOfferCanonical
	quarter, two, one, five := 0.25, 2.0, 1.0, 5.0
	wide, long, mid, short := 400000, 128000, 200000, 64000
	return ai.Catalog{
		Providers: []ai.CatalogProvider{
			{ID: "openai", Name: "OpenAI", NPM: &openai},
			{ID: "anthropic", Name: "Anthropic", NPM: &anthropic},
			{ID: "openrouter", Name: "OpenRouter", APIURL: &router},
		},
		Models: []ai.CatalogModel{
			{ProviderID: "openai", ModelKey: e2eGatewayModel, CanonicalID: &review, Name: "GPT-5 Mini", InputModalities: []string{text, image}, OutputModalities: []string{text}, ContextLimit: &wide, OutputLimit: &long, Temperature: true, Reasoning: true, InputPrice: &quarter, OutputPrice: &two},
			{ProviderID: "openai", ModelKey: e2eGatewayScreen, CanonicalID: &screen, Name: "omni-moderation-latest", Type: &moderation, InputModalities: []string{text, image}},
			{ProviderID: "anthropic", ModelKey: e2eOfferedModel, CanonicalID: &offered, Name: "Claude Haiku 4.5", InputModalities: []string{text, image}, OutputModalities: []string{text}, ContextLimit: &mid, OutputLimit: &short, Temperature: true, Reasoning: true, InputPrice: &one, OutputPrice: &five},
		},
	}
}

func (s *e2eSeeder) seedAIGateway(ctx context.Context, tx *ent.Client) error {
	now := s.now().UTC()
	if _, err := aipg.NewCatalogStore(tx).ReplaceCatalog(ctx, e2eCatalog(), now); err != nil {
		return fmt.Errorf("seed ai catalog: %w", err)
	}
	gateway := e2eAIGateway{
		seededAt:    now,
		requests:    aipg.NewRequestStore(tx),
		repo:        aipg.NewRepository(tx),
		reviewScene: aimoderation.ReviewScene,
		screenScene: aimoderation.ScreenScene,
		formatScene: aiwalkthrough.FormatScene,
	}
	if err := gateway.seedRoutes(ctx); err != nil {
		return err
	}
	return gateway.seedRequests(ctx)
}

func (g *e2eAIGateway) seedRoutes(ctx context.Context) error {
	baseURL := e2eUnreachableAIBaseURL
	var err error
	if g.primary, err = g.repo.CreateProvider(ctx, ai.NewProvider{Name: "e2e-unreachable", Kind: ai.KindCompatible, BaseURL: &baseURL, APIKey: e2eUnreachableAIKey, PriceMultiplier: 1}); err != nil {
		return fmt.Errorf("seed ai provider: %w", err)
	}
	if g.backup, err = g.repo.CreateProvider(ctx, ai.NewProvider{Name: e2eBackupProvider, Kind: ai.KindCompatible, BaseURL: &baseURL, APIKey: e2eUnreachableAIKey, PriceMultiplier: 1}); err != nil {
		return fmt.Errorf("seed backup ai provider: %w", err)
	}
	review, screen, offered := e2eReviewCanonical, e2eScreenCanonical, e2eOfferCanonical
	wide, long := 400000, 128000
	if g.reviewModel, err = g.repo.CreateModel(ctx, ai.NewModel{Key: e2eGatewayModel, Name: e2eGatewayModel, CanonicalID: &review, Capabilities: ai.Capabilities{Vision: true, Temperature: true, Reasoning: true, ContextLimit: &wide, OutputLimit: &long}}); err != nil {
		return fmt.Errorf("seed ai model %s: %w", e2eGatewayModel, err)
	}
	if g.screenModel, err = g.repo.CreateModel(ctx, ai.NewModel{Key: e2eGatewayScreen, Name: e2eGatewayScreen, CanonicalID: &screen, Capabilities: ai.Capabilities{Vision: true, Moderation: true}}); err != nil {
		return fmt.Errorf("seed ai model %s: %w", e2eGatewayScreen, err)
	}
	price := ai.Price{Input: 0.25, Output: 2}
	if g.reviewRoute, err = g.repo.CreateRoute(ctx, ai.NewRoute{ModelID: g.reviewModel, ProviderID: g.primary, UpstreamID: e2eGatewayModel, Protocol: ai.ProtocolChat, Price: price}); err != nil {
		return fmt.Errorf("seed ai route: %w", err)
	}
	if g.backupRoute, err = g.repo.CreateRoute(ctx, ai.NewRoute{ModelID: g.reviewModel, ProviderID: g.backup, UpstreamID: "openai/" + e2eGatewayModel, Protocol: ai.ProtocolChat, Price: price, Priority: 1}); err != nil {
		return fmt.Errorf("seed backup ai route: %w", err)
	}
	if g.screenRoute, err = g.repo.CreateRoute(ctx, ai.NewRoute{ModelID: g.screenModel, ProviderID: g.primary, UpstreamID: e2eGatewayScreen, Protocol: ai.ProtocolModeration}); err != nil {
		return fmt.Errorf("seed moderation ai route: %w", err)
	}
	jsonMode := true
	if err := g.repo.UpdateRoute(ctx, g.reviewRoute, ai.RouteChanges{JSONMode: &jsonMode}); err != nil {
		return fmt.Errorf("seed ai route adaptation: %w", err)
	}
	if err := g.repo.SaveAdjustments(ctx, g.reviewRoute, []ai.NewAdjustment{{Kind: ai.AdjustJSONMode, Value: "json", ErrorKind: ai.ErrorStructured}}); err != nil {
		return fmt.Errorf("seed ai route adjustment: %w", err)
	}
	if _, err := g.repo.SuspendRoute(ctx, g.backupRoute, ai.Failure{Kind: ai.ErrorQuota, Message: e2eQuotaMessage}, g.seededAt.Add(-20*time.Minute)); err != nil {
		return fmt.Errorf("seed suspended ai route: %w", err)
	}
	offers := []ai.Offer{
		{ProviderID: g.primary, UpstreamID: e2eGatewayModel, CanonicalID: &review, SyncedAt: g.seededAt},
		{ProviderID: g.primary, UpstreamID: e2eGatewayScreen, CanonicalID: &screen, SyncedAt: g.seededAt},
		{ProviderID: g.primary, UpstreamID: e2eOfferedModel, CanonicalID: &offered, SyncedAt: g.seededAt},
	}
	if err := g.repo.ReplaceOffers(ctx, g.primary, offers); err != nil {
		return fmt.Errorf("seed ai offers: %w", err)
	}
	for scene, model := range map[string]int{g.screenScene: g.screenModel, g.reviewScene: g.reviewModel, g.formatScene: g.reviewModel} {
		if err := g.repo.SaveSceneConfig(ctx, ai.SceneConfig{Key: scene, ModelID: &model}); err != nil {
			return fmt.Errorf("seed ai scene %s: %w", scene, err)
		}
	}
	return nil
}

func (g *e2eAIGateway) seedRequests(ctx context.Context) error {
	stop := ai.FinishStop
	first := 455 * time.Millisecond
	output := e2eReviewOutput
	prompt := &ai.Payload{
		System:   "Seeded moderation instructions.",
		Messages: []ai.Message{{Role: ai.RoleUser, Content: "Seeded comment under review."}},
		Schema:   []byte(`{"type":"object","properties":{"decision":{"type":"string"}}}`),
	}
	answered := *prompt
	answered.Output = &output
	screened := `{"flagged":false}`
	records := []ai.RequestRecord{
		{CallID: "e2e0c411-0000-4000-8000-000000000005", Source: ai.SourcePlayground, ModelID: &g.reviewModel, RouteID: &g.backupRoute, ProviderID: &g.backup, UpstreamID: "openai/" + e2eGatewayModel, Protocol: ai.ProtocolChat, Failure: &ai.Failure{Kind: ai.ErrorQuota, Message: e2eQuotaMessage}, Duration: 301 * time.Millisecond, Created: g.seededAt.Add(-3 * time.Hour)},
		{CallID: "e2e0c411-0000-4000-8000-000000000004", Source: ai.SourceCheck, ModelID: &g.screenModel, RouteID: &g.screenRoute, ProviderID: &g.primary, UpstreamID: e2eGatewayScreen, Protocol: ai.ProtocolModeration, OK: true, Duration: 640 * time.Millisecond, Usage: ai.Usage{InputTokens: 4}, Created: g.seededAt.Add(-2 * time.Hour)},
		{CallID: "e2e0c411-0000-4000-8000-000000000003", Source: ai.SourceScene, Scene: &g.reviewScene, ModelID: &g.reviewModel, RouteID: &g.reviewRoute, ProviderID: &g.primary, UpstreamID: e2eGatewayModel, Protocol: ai.ProtocolChat, Failure: &ai.Failure{Kind: ai.ErrorTimeout, Message: "no data for 30s"}, Duration: 30 * time.Second, Created: g.seededAt.Add(-90 * time.Minute)},
		{CallID: "e2e0c411-0000-4000-8000-000000000002", Source: ai.SourceScene, Scene: &g.screenScene, ModelID: &g.screenModel, RouteID: &g.screenRoute, ProviderID: &g.primary, UpstreamID: e2eGatewayScreen, Protocol: ai.ProtocolModeration, OK: true, Duration: 214 * time.Millisecond, Usage: ai.Usage{InputTokens: 212}, Created: g.seededAt.Add(-25 * time.Minute), Payload: &ai.Payload{Messages: prompt.Messages, Output: &screened}},
		{CallID: e2eReviewCall, Source: ai.SourceScene, Scene: &g.reviewScene, ModelID: &g.reviewModel, RouteID: &g.backupRoute, ProviderID: &g.backup, UpstreamID: "openai/" + e2eGatewayModel, Protocol: ai.ProtocolChat, Failure: &ai.Failure{Kind: ai.ErrorQuota, Message: e2eQuotaMessage, Detail: "HTTP 402 from the upstream"}, Duration: 318 * time.Millisecond, Created: g.seededAt.Add(-20 * time.Minute), Payload: prompt},
		{CallID: e2eReviewCall, Source: ai.SourceScene, Scene: &g.reviewScene, ModelID: &g.reviewModel, RouteID: &g.reviewRoute, ProviderID: &g.primary, UpstreamID: e2eGatewayModel, Protocol: ai.ProtocolChat, OK: true, FinishReason: &stop, FirstToken: &first, Duration: 2100 * time.Millisecond, Usage: ai.Usage{InputTokens: 1480, OutputTokens: 112, ReasoningTokens: 64}, CostUSD: 0.000594, Created: g.seededAt.Add(-20*time.Minute + time.Second), Payload: &answered},
	}
	for _, record := range records {
		if _, err := g.requests.Record(ctx, record); err != nil {
			return fmt.Errorf("seed ai request %s: %w", record.CallID, err)
		}
	}
	return nil
}
