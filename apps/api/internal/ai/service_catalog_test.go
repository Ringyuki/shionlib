package ai_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestSyncLinksModelsAndPricesRoutesFromTheCatalog(t *testing.T) {
	f := newFixture(t)
	relay := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.test/v1"), APIKey: "key", PriceMultiplier: 2, CatalogProviderID: ptr("relay")}))
	openai := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "openai", Kind: ai.KindOpenAI, APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("openai")}))
	model := f.model(t, "gpt-5-mini", ai.Capabilities{Temperature: true})
	relayRoute := must(f.repo.CreateRoute(t.Context(), ai.NewRoute{ModelID: model, ProviderID: relay, UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolChat, Priority: 0}))
	openaiRoute := must(f.repo.CreateRoute(t.Context(), ai.NewRoute{ModelID: model, ProviderID: openai, UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolResponses, Priority: 1}))
	manual := must(f.repo.CreateRoute(t.Context(), ai.NewRoute{ModelID: f.model(t, "manual", ai.Capabilities{}), ProviderID: openai, UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolResponses, PriceManual: true, Price: ai.Price{Input: 9, Output: 9}}))

	f.source.catalog = sampleCatalog()
	result, err := f.catalog.Sync(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if result.Providers != 3 || result.Added != 5 || result.Repriced != 2 {
		t.Fatalf("result %+v", result)
	}
	linked := must(f.repo.GetModel(t.Context(), model))
	if linked.CanonicalID == nil || *linked.CanonicalID != "openai/gpt-5-mini" || linked.Temperature || !linked.Vision || !linked.Reasoning || *linked.OutputLimit != 128000 {
		t.Fatalf("capabilities come from the lab's entry: %+v", linked)
	}
	if price := must(f.repo.GetRoute(t.Context(), relayRoute)).Price; price.Input != 0.6 || price.Output != 4.8 {
		t.Fatalf("exact provider prices are scaled by the multiplier: %+v", price)
	}
	if price := must(f.repo.GetRoute(t.Context(), openaiRoute)).Price; price.Input != 0.25 || *price.CacheRead != 0.025 {
		t.Fatalf("official prices: %+v", price)
	}
	if price := must(f.repo.GetRoute(t.Context(), manual)).Price; price.Input != 9 {
		t.Fatalf("manual prices stay: %+v", price)
	}
	again := must(f.catalog.Sync(t.Context()))
	if again.Added != 0 || again.Repriced != 0 {
		t.Fatalf("a second sync changes nothing: %+v", again)
	}
}

func TestSyncIfStaleOnlyFetchesOldCatalogs(t *testing.T) {
	f := newFixture(t)
	f.source.catalog = sampleCatalog()
	if err := f.catalog.SyncIfStale(t.Context()); err != nil {
		t.Fatal(err)
	}
	f.source.err = errors.New("must not fetch")
	f.clock.Advance(time.Hour)
	if err := f.catalog.SyncIfStale(t.Context()); err != nil {
		t.Fatalf("fresh catalogs are not fetched: %v", err)
	}
	f.clock.Advance(20 * time.Hour)
	if err := f.catalog.SyncIfStale(t.Context()); err == nil {
		t.Fatal("stale catalogs are fetched")
	}
}

func TestCatalogProvidersAndModels(t *testing.T) {
	f := newFixture(t)
	f.syncCatalog(t)
	providers := must(f.catalog.Providers(t.Context()))
	kinds := map[string]ai.ProviderKind{}
	for _, provider := range providers {
		kinds[provider.ID] = provider.Kind
	}
	if kinds["openai"] != ai.KindOpenAI || kinds["anthropic"] != ai.KindAnthropic || kinds["relay"] != ai.KindCompatible {
		t.Fatalf("providers %+v", providers)
	}
	relay := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.test/v1"), APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("relay")}))
	if err := f.repo.ReplaceOffers(t.Context(), relay, []ai.Offer{{ProviderID: relay, UpstreamID: "gpt-5-mini", Protocols: []ai.Protocol{ai.ProtocolChat}, CanonicalID: ptr("openai/gpt-5-mini"), SyncedAt: f.clock.Now()}}); err != nil {
		t.Fatal(err)
	}
	entries := must(f.catalog.Models(t.Context(), ""))
	if len(entries) != 1 || entries[0].CanonicalID != "openai/gpt-5-mini" || len(entries[0].Offers) != 1 || entries[0].Offers[0].Protocol != ai.ProtocolChat || *entries[0].Offers[0].InputPrice != 0.3 {
		t.Fatalf("entries %+v", entries)
	}
	searched := must(f.catalog.Models(t.Context(), "claude"))
	if len(searched) != 1 || searched[0].Name != "Claude Sonnet 4" || !searched[0].Vision || len(searched[0].Offers) != 0 {
		t.Fatalf("search %+v", searched)
	}
}

func TestCatalogFailuresSurface(t *testing.T) {
	f := newFixture(t)
	f.source.err = ai.ErrCatalogUnavailable.Wrap(errors.New("timeout"))
	if _, err := f.catalog.Sync(t.Context()); !errors.Is(err, ai.ErrCatalogUnavailable) {
		t.Fatalf("sync: %v", err)
	}
}
