package aitest

import (
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func catalogFixture() ai.Catalog {
	return ai.Catalog{
		Providers: []ai.CatalogProvider{
			{ID: "openai", Name: "OpenAI", NPM: ptr("@ai-sdk/openai"), DocURL: ptr("https://platform.openai.com/docs")},
			{ID: "relay", Name: "A Relay", NPM: ptr("@ai-sdk/openai-compatible"), APIURL: ptr("https://relay.example/v1")},
			{ID: "openai", Name: "Duplicate"},
		},
		Models: []ai.CatalogModel{
			{
				ProviderID: "openai", ModelKey: "gpt-5", CanonicalID: ptr("openai/gpt-5"), Name: "GPT-5", Type: ptr("chat"), Family: ptr("gpt"),
				InputModalities: []string{"text", "image"}, OutputModalities: []string{"text"}, ContextLimit: ptr(400000), OutputLimit: ptr(128000),
				Temperature: false, ToolCall: true, Reasoning: true, StructuredOutput: ptr(true), InputPrice: ptr(1.25), OutputPrice: ptr(10.0),
				CacheReadPrice: ptr(0.125), PriceTiers: []ai.PriceTier{{Over: 272000, Input: 2.5, Output: 20, CacheRead: ptr(0.25)}}, ReleaseDate: ptr("2025-08-07"),
			},
			{ProviderID: "openai", ModelKey: "gpt-5-mini", CanonicalID: ptr("openai/gpt-5-mini"), Name: "GPT-5 mini", Temperature: true, InputPrice: ptr(0.25), OutputPrice: ptr(2.0)},
			{ProviderID: "relay", ModelKey: "gpt-5", CanonicalID: ptr("openai/gpt-5"), Name: "GPT-5 (relay)", Temperature: true},
			{ProviderID: "relay", ModelKey: "gpt-5", Name: "duplicate entry"},
			{ProviderID: "ghost", ModelKey: "orphan", Name: "Orphan"},
		},
	}
}

func normalizeCatalogModels(models []ai.CatalogModel) []ai.CatalogModel {
	normalized := make([]ai.CatalogModel, len(models))
	for i, model := range models {
		normalized[i] = normalizedCatalogModel(model)
	}
	return normalized
}

func CatalogStoreContract(t *testing.T, newStore func(t *testing.T) ai.CatalogStore) {
	t.Run("catalog snapshots are diffed against the stored rows", func(t *testing.T) {
		store := newStore(t)
		ctx := t.Context()
		at := contractTime
		fixture := catalogFixture()
		changes := must(store.ReplaceCatalog(ctx, fixture, at))(t)
		if changes != (ai.CatalogChanges{Providers: 2, Models: 3, Added: 3}) {
			t.Fatalf("first sync %+v", changes)
		}
		loaded := must(store.LoadCatalog(ctx))(t)
		if len(loaded.Providers) != 2 || !reflect.DeepEqual(loaded.Providers[0], fixture.Providers[0]) || loaded.Providers[1].ID != "relay" || *loaded.Providers[1].APIURL != "https://relay.example/v1" {
			t.Fatalf("providers %+v", loaded.Providers)
		}
		want := normalizeCatalogModels(fixture.Models[:3])
		slices.SortFunc(want, func(a, b ai.CatalogModel) int {
			if a.ProviderID != b.ProviderID {
				if a.ProviderID < b.ProviderID {
					return -1
				}
				return 1
			}
			if a.ModelKey < b.ModelKey {
				return -1
			}
			if a.ModelKey > b.ModelKey {
				return 1
			}
			return 0
		})
		if !reflect.DeepEqual(normalizeCatalogModels(loaded.Models), want) {
			t.Fatalf("models\n got %+v\nwant %+v", loaded.Models, want)
		}
		status := must(store.CatalogStatus(ctx))(t)
		if status.Providers != 2 || status.Models != 3 || status.SyncedAt == nil || !status.SyncedAt.Equal(at) {
			t.Fatalf("status %+v", status)
		}
		if again := must(store.ReplaceCatalog(ctx, fixture, at.Add(time.Hour)))(t); again != (ai.CatalogChanges{Providers: 2, Models: 3}) {
			t.Fatalf("unchanged sync %+v", again)
		}
		next := catalogFixture()
		next.Models[1].InputPrice = ptr(0.3)
		next.Models[2] = ai.CatalogModel{ProviderID: "relay", ModelKey: "claude", CanonicalID: ptr("anthropic/claude"), Name: "Claude 100%", Temperature: true}
		next.Models = slices.Delete(next.Models, 3, 4)
		changes = must(store.ReplaceCatalog(ctx, next, at.Add(2*time.Hour)))(t)
		if changes != (ai.CatalogChanges{Providers: 2, Models: 3, Added: 1, Updated: 1, Removed: 1}) {
			t.Fatalf("second sync %+v", changes)
		}
		if status = must(store.CatalogStatus(ctx))(t); !status.SyncedAt.Equal(at.Add(2 * time.Hour)) {
			t.Fatalf("synced at %+v", status.SyncedAt)
		}
		providers := must(store.CatalogProviders(ctx))(t)
		if len(providers) != 2 || providers[0].ID != "relay" || providers[0].Models != 1 || providers[1].ID != "openai" || providers[1].Models != 2 {
			t.Fatalf("catalog providers %+v", providers)
		}
		if ids := must(store.SearchCanonicalIDs(ctx, "GPT", 10))(t); !slices.Equal(ids, []string{"openai/gpt-5", "openai/gpt-5-mini"}) {
			t.Fatalf("search %v", ids)
		}
		if ids := must(store.SearchCanonicalIDs(ctx, "gpt", 1))(t); !slices.Equal(ids, []string{"openai/gpt-5"}) {
			t.Fatalf("limited search %v", ids)
		}
		if ids := must(store.SearchCanonicalIDs(ctx, "100%", 10))(t); !slices.Equal(ids, []string{"anthropic/claude"}) {
			t.Fatalf("wildcards are literal: %v", ids)
		}
		if ids := must(store.SearchCanonicalIDs(ctx, "_", 10))(t); len(ids) != 0 {
			t.Fatalf("underscores are literal: %v", ids)
		}
	})
}
