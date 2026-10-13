package ai_test

import (
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestProvidersValidateTheirConnection(t *testing.T) {
	f := newFixture(t)
	f.syncCatalog(t)
	if _, err := f.providers.Create(t.Context(), ai.ProviderInput{Name: "relay", Kind: ai.KindCompatible, APIKey: "key"}); !errors.Is(err, ai.ErrBaseURLRequired) {
		t.Fatalf("base url: %v", err)
	}
	if _, err := f.providers.Create(t.Context(), ai.ProviderInput{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.test/v1"), APIKey: "key", CatalogProviderID: ptr("nowhere")}); !errors.Is(err, ai.ErrCatalogProviderNotFound) {
		t.Fatalf("catalog provider: %v", err)
	}
	created, err := f.providers.Create(t.Context(), ai.ProviderInput{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr(" https://relay.test/v1/ "), APIKey: "sk-relay-0123456789abcdef", CatalogProviderID: ptr("relay")})
	if err != nil {
		t.Fatal(err)
	}
	if *created.BaseURL != "https://relay.test/v1" || created.KeyHint != "sk-…cdef" || created.PriceMultiplier != 1 || !created.Enabled || created.RouteViews == nil {
		t.Fatalf("created %+v", created)
	}
	if _, err := f.providers.Create(t.Context(), ai.ProviderInput{Name: "relay", Kind: ai.KindOpenAI, APIKey: "key"}); !errors.Is(err, ai.ErrProviderNameTaken) {
		t.Fatalf("name: %v", err)
	}
	cleared := (*string)(nil)
	if _, err := f.providers.Update(t.Context(), created.ID, ai.ProviderUpdate{BaseURL: &cleared}); !errors.Is(err, ai.ErrBaseURLRequired) {
		t.Fatalf("clearing the base url of a compatible provider: %v", err)
	}
	if _, err := f.providers.Get(t.Context(), 999); !errors.Is(err, ai.ErrProviderNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestChangingTheKindRealignsRouteProtocols(t *testing.T) {
	f := newFixture(t)
	provider := f.provider(t, "relay", ai.KindCompatible)
	chat := f.model(t, "chat", ai.Capabilities{Temperature: true})
	route := f.route(t, chat, provider, ai.ProtocolChat, 0)
	kind := ai.KindAnthropic
	if _, err := f.providers.Update(t.Context(), provider, ai.ProviderUpdate{Kind: &kind}); err != nil {
		t.Fatal(err)
	}
	if updated := must(f.repo.GetRoute(t.Context(), route)); updated.Protocol != ai.ProtocolMessages {
		t.Fatalf("route %+v", updated)
	}
}

func TestDiscoveryRecordsOffersAndMatchesSiteModels(t *testing.T) {
	f := newFixture(t)
	f.syncCatalog(t)
	provider := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.test/v1"), APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("relay")}))
	f.upstream.models = []ai.UpstreamModel{
		{ID: "gpt-5-mini", Protocols: []ai.Protocol{ai.ProtocolChat, ai.ProtocolResponses}},
		{ID: "omni-moderation-latest"},
		{ID: "gpt-image-1"},
		{ID: "house-model", Owner: ptr("house")},
	}
	existing := f.model(t, "gpt-5-mini", ai.Capabilities{Temperature: true})
	discovery := must(f.providers.Discover(t.Context(), provider))
	if discovery.Failure != nil || len(discovery.Models) != 3 {
		t.Fatalf("discovery %+v", discovery)
	}
	byID := map[string]ai.DiscoveredOffer{}
	for _, model := range discovery.Models {
		byID[model.UpstreamID] = model
	}
	gpt := byID["gpt-5-mini"]
	if gpt.ModelID == nil || *gpt.ModelID != existing || gpt.Protocol != ai.ProtocolResponses || *gpt.InputPrice != 0.3 || *gpt.CanonicalID != "openai/gpt-5-mini" {
		t.Fatalf("gpt %+v", gpt)
	}
	if moderation := byID["omni-moderation-latest"]; !moderation.Moderation || !slices.Equal(moderation.Protocols, []ai.Protocol{ai.ProtocolModeration}) {
		t.Fatalf("moderation %+v", moderation)
	}
	if house := byID["house-model"]; house.Lab == nil || *house.Lab != "house" || house.CanonicalID != nil {
		t.Fatalf("unknown models keep the owner as lab: %+v", house)
	}
	offers := must(f.repo.ListOffers(t.Context(), ai.OfferFilter{ProviderIDs: []int{provider}}))
	if len(offers) != 3 {
		t.Fatalf("offers %+v", offers)
	}
	f.upstream.listErr = &ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401", Detail: "401 https://relay.test/v1/models"}
	failed := must(f.providers.Discover(t.Context(), provider))
	if failed.Failure == nil || failed.Failure.Kind != ai.ErrorAuth || len(failed.Models) != 0 {
		t.Fatalf("failure %+v", failed)
	}
	if offers := must(f.repo.ListOffers(t.Context(), ai.OfferFilter{ProviderIDs: []int{provider}})); len(offers) != 3 {
		t.Fatalf("a failed discovery keeps the last offers: %+v", offers)
	}
	if connections := f.upstream.connections; connections[0].APIKey != "key" {
		t.Fatalf("discovery uses the decrypted key: %+v", connections)
	}
}

func TestAddRoutesCreatesMissingModelsAndSkipsCoveredOnes(t *testing.T) {
	f := newFixture(t)
	f.syncCatalog(t)
	provider := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "openai", Kind: ai.KindOpenAI, APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("openai")}))
	result := must(f.providers.AddRoutes(t.Context(), provider, []ai.RouteItem{
		{UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolChat},
		{UpstreamID: "omni-moderation-latest", Protocol: ai.ProtocolResponses},
		{UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolChat},
	}))
	if len(result.RouteIDs) != 2 || len(result.Skipped) != 0 {
		t.Fatalf("result %+v", result)
	}
	routes := must(f.repo.ListRoutes(t.Context(), ai.RouteFilter{ProviderID: &provider}))
	protocols := map[string]ai.Protocol{}
	for _, route := range routes {
		protocols[route.UpstreamID] = route.Protocol
	}
	if protocols["gpt-5-mini"] != ai.ProtocolResponses || protocols["omni-moderation-latest"] != ai.ProtocolModeration {
		t.Fatalf("protocols follow the provider kind and the model: %+v", protocols)
	}
	models := must(f.repo.ListModels(t.Context()))
	keys := make([]string, len(models))
	for i, model := range models {
		keys[i] = model.Key
	}
	slices.Sort(keys)
	if !slices.Equal(keys, []string{"gpt-5-mini", "omni-moderation-latest"}) {
		t.Fatalf("models %v", keys)
	}
	again := must(f.providers.AddRoutes(t.Context(), provider, []ai.RouteItem{{UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolResponses}}))
	if len(again.RouteIDs) != 0 || !slices.Equal(again.Skipped, []string{"gpt-5-mini"}) {
		t.Fatalf("again %+v", again)
	}
	resolved := must(f.providers.Resolve(t.Context(), provider, []string{"gpt-5-mini", "claude-sonnet-4", "unknown"}))
	if resolved[0].ModelID == nil || *resolved[1].CanonicalID != "anthropic/claude-sonnet-4" || resolved[1].ModelID != nil || resolved[2].CanonicalID != nil {
		t.Fatalf("resolved %+v", resolved)
	}
}

func TestEndpointPreview(t *testing.T) {
	f := newFixture(t)
	if url := f.providers.Endpoint(ai.KindCompatible, nil); url != nil {
		t.Fatalf("compatible providers need a base url: %v", *url)
	}
	if url := f.providers.Endpoint(ai.KindCompatible, ptr("https://relay.test/v1/")); url == nil || !strings.HasPrefix(*url, "https://relay.test/v1/") {
		t.Fatalf("url %v", url)
	}
	if url := f.providers.Endpoint(ai.KindAnthropic, nil); url == nil || *url != "https://default.test/messages" {
		t.Fatalf("url %v", url)
	}
}

func TestSyncOffersSkipsFailingProviders(t *testing.T) {
	f := newFixture(t)
	f.provider(t, "alpha", ai.KindCompatible)
	f.upstream.listErr = &ai.Failure{Kind: ai.ErrorNetwork, Message: "dial tcp"}
	if err := f.providers.SyncOffers(t.Context()); err != nil {
		t.Fatalf("upstream failures are not errors: %v", err)
	}
}
