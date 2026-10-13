package ai_test

import (
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestModelsAreCreatedFromTheCatalogWithRoutes(t *testing.T) {
	f := newFixture(t)
	f.syncCatalog(t)
	openai := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "openai", Kind: ai.KindOpenAI, APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("openai")}))
	relay := must(f.repo.CreateProvider(t.Context(), ai.NewProvider{Name: "relay", Kind: ai.KindCompatible, BaseURL: ptr("https://relay.test/v1"), APIKey: "key", PriceMultiplier: 1, CatalogProviderID: ptr("relay")}))
	if _, err := f.models.Create(t.Context(), ai.ModelInput{CanonicalID: "openai/missing", Name: "x"}); !errors.Is(err, ai.ErrCatalogModelNotFound) {
		t.Fatalf("missing canonical: %v", err)
	}
	if _, err := f.models.Create(t.Context(), ai.ModelInput{CanonicalID: "openai/gpt-5-mini", Name: "x", Routes: []ai.RouteSource{{ProviderID: openai, UpstreamID: "a"}, {ProviderID: openai, UpstreamID: "b"}}}); !errors.Is(err, ai.ErrRouteOrderInvalid) {
		t.Fatalf("duplicate providers: %v", err)
	}
	view, err := f.models.Create(t.Context(), ai.ModelInput{CanonicalID: "openai/gpt-5-mini", Name: "GPT mini", Routes: []ai.RouteSource{
		{ProviderID: relay, UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolChat},
		{ProviderID: openai, UpstreamID: "gpt-5-mini", Protocol: ai.ProtocolChat},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if view.Key != "gpt-5-mini" || !view.Vision || len(view.RouteViews) != 2 || view.RouteViews[0].Provider.ID != relay || view.RouteViews[1].Protocol != ai.ProtocolResponses || view.RouteViews[0].Price.Input != 0.3 {
		t.Fatalf("view %+v", view)
	}
	if _, err := f.models.Create(t.Context(), ai.ModelInput{CanonicalID: "openai/gpt-5-mini", Name: "again"}); !errors.Is(err, ai.ErrModelTaken) {
		t.Fatalf("taken: %v", err)
	}
	if _, err := f.models.Update(t.Context(), view.ID, ai.ModelUpdate{Vision: ptr(false)}); !errors.Is(err, ai.ErrCatalogOwned) {
		t.Fatalf("vision belongs to the catalog: %v", err)
	}
}

func TestDefaultModelsAreExclusiveAndCannotBeDeleted(t *testing.T) {
	f := newFixture(t)
	first := f.model(t, "first", ai.Capabilities{})
	second := f.model(t, "second", ai.Capabilities{})
	if _, err := f.models.Update(t.Context(), first, ai.ModelUpdate{IsDefault: ptr(true)}); err != nil {
		t.Fatal(err)
	}
	view := must(f.models.Update(t.Context(), second, ai.ModelUpdate{IsDefault: ptr(true), Name: ptr("Second")}))
	if !view.IsDefault || view.Name != "Second" || must(f.repo.GetModel(t.Context(), first)).IsDefault {
		t.Fatalf("view %+v", view)
	}
	if len(view.Scenes) != len(scenes) || view.Scenes[0].Role != ai.SceneRoleDefault {
		t.Fatalf("the default model serves unconfigured scenes: %+v", view.Scenes)
	}
	if err := f.models.Delete(t.Context(), second); !errors.Is(err, ai.ErrDefaultModelDelete) {
		t.Fatalf("delete default: %v", err)
	}
	if err := f.models.Delete(t.Context(), first); err != nil {
		t.Fatal(err)
	}
}

func TestRoutesAreReorderedAndAdded(t *testing.T) {
	f := newFixture(t)
	setup := f.twoRoutes(t, textScene)
	if _, err := f.models.Reorder(t.Context(), setup.modelID, []int{setup.primary}); !errors.Is(err, ai.ErrRouteOrderInvalid) {
		t.Fatalf("partial order: %v", err)
	}
	view := must(f.models.Reorder(t.Context(), setup.modelID, []int{setup.backup, setup.primary}))
	if view.RouteViews[0].ID != setup.backup || view.Scenes[0].Role != ai.SceneRolePrimary {
		t.Fatalf("view %+v", view)
	}
	third := f.provider(t, "gamma", ai.KindGoogle)
	route := must(f.models.AddRoute(t.Context(), setup.modelID, ai.RouteSource{ProviderID: third, UpstreamID: "gemini", Protocol: ai.ProtocolChat, PriceManual: true, InputPrice: ptr(1.5)}))
	if route.Protocol != ai.ProtocolGemini || route.Priority != 2 || route.Price.Input != 1.5 || !route.PriceManual {
		t.Fatalf("route %+v", route)
	}
	if _, err := f.models.AddRoute(t.Context(), setup.modelID, ai.RouteSource{ProviderID: third, UpstreamID: "again"}); !errors.Is(err, ai.ErrRouteTaken) {
		t.Fatalf("taken: %v", err)
	}
}
