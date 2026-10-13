package aitest

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type RepositoryEnv struct {
	Repo            ai.Repository
	SuperAdmin      func(t *testing.T) int
	CatalogProvider func(t *testing.T, id string)
}

var contractTime = time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)

func ptr[T any](value T) *T {
	return &value
}

func expectError(t *testing.T, err, want error) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Fatalf("got %v, want %v", err, want)
	}
}

func must[T any](value T, err error) func(t *testing.T) T {
	return func(t *testing.T) T {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
}

func createProvider(t *testing.T, repo ai.Repository, name string) int {
	t.Helper()
	return must(repo.CreateProvider(t.Context(), ai.NewProvider{
		Name:            name,
		Kind:            ai.KindCompatible,
		BaseURL:         ptr("https://" + name + ".example/v1"),
		APIKey:          "sk-" + name + "-0123456789abcdef",
		PriceMultiplier: 1,
	}))(t)
}

func createModel(t *testing.T, repo ai.Repository, key string) int {
	t.Helper()
	return must(repo.CreateModel(t.Context(), ai.NewModel{Key: key, Name: strings.ToUpper(key), Capabilities: ai.Capabilities{Temperature: true}}))(t)
}

func createRoute(t *testing.T, repo ai.Repository, modelID, providerID, priority int) int {
	t.Helper()
	return must(repo.CreateRoute(t.Context(), ai.NewRoute{
		ModelID:    modelID,
		ProviderID: providerID,
		UpstreamID: "upstream-" + strings.Repeat("x", priority+1),
		Protocol:   ai.ProtocolChat,
		Price:      ai.Price{Input: 1, Output: 2},
		Priority:   priority,
	}))(t)
}

func routeIDs(routes []ai.Route) []int {
	ids := make([]int, len(routes))
	for i, route := range routes {
		ids[i] = route.ID
	}
	return ids
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) RepositoryEnv) {
	t.Run("providers are created, renamed and deleted", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		alpha := must(env.Repo.CreateProvider(ctx, ai.NewProvider{
			Name: "alpha", Kind: ai.KindCompatible, BaseURL: ptr("https://a.example/v1"), APIKey: "sk-alpha-0123456789", PriceMultiplier: 1.5,
		}))(t)
		_, err := env.Repo.CreateProvider(ctx, ai.NewProvider{Name: "alpha", Kind: ai.KindOpenAI, APIKey: "x", PriceMultiplier: 1})
		expectError(t, err, ai.ErrProviderNameTaken)
		provider := must(env.Repo.GetProvider(ctx, alpha))(t)
		if provider.Name != "alpha" || provider.Kind != ai.KindCompatible || *provider.BaseURL != "https://a.example/v1" || provider.KeyHint != "sk-…6789" ||
			provider.PriceMultiplier != 1.5 || !provider.Enabled || provider.CatalogProviderID != nil {
			t.Fatalf("provider %+v", provider)
		}
		if connection := must(env.Repo.ProviderConnection(ctx, alpha))(t); connection.APIKey != "sk-alpha-0123456789" || *connection.BaseURL != "https://a.example/v1" || connection.Kind != ai.KindCompatible {
			t.Fatalf("connection %+v", connection)
		}
		if !must(env.Repo.ProviderNameTaken(ctx, "alpha", 0))(t) || must(env.Repo.ProviderNameTaken(ctx, "alpha", alpha))(t) || must(env.Repo.ProviderNameTaken(ctx, "beta", 0))(t) {
			t.Fatal("name checks")
		}
		beta := must(env.Repo.CreateProvider(ctx, ai.NewProvider{Name: "beta", Kind: ai.KindOpenAI, APIKey: "short", PriceMultiplier: 1}))(t)
		if hint := must(env.Repo.GetProvider(ctx, beta))(t).KeyHint; hint != "…" {
			t.Fatalf("short keys only show an ellipsis: %q", hint)
		}
		expectError(t, env.Repo.UpdateProvider(ctx, beta, ai.ProviderChanges{Name: ptr("alpha")}), ai.ErrProviderNameTaken)
		var noURL *string
		env.CatalogProvider(t, "openai")
		if err := env.Repo.UpdateProvider(ctx, alpha, ai.ProviderChanges{
			Kind: ptr(ai.KindOpenAI), BaseURL: &noURL, APIKey: ptr("sk-rotated-abcdefgh"), PriceMultiplier: ptr(2.0),
			CatalogProviderID: ptr(ptr("openai")), Enabled: ptr(false),
		}); err != nil {
			t.Fatal(err)
		}
		provider = must(env.Repo.GetProvider(ctx, alpha))(t)
		if provider.Kind != ai.KindOpenAI || provider.BaseURL != nil || provider.KeyHint != "sk-…efgh" || provider.PriceMultiplier != 2 ||
			provider.CatalogProviderID == nil || *provider.CatalogProviderID != "openai" || provider.Enabled {
			t.Fatalf("updated provider %+v", provider)
		}
		if connection := must(env.Repo.ProviderConnection(ctx, alpha))(t); connection.APIKey != "sk-rotated-abcdefgh" || connection.BaseURL != nil {
			t.Fatalf("rotated connection %+v", connection)
		}
		var noCatalog *string
		if err := env.Repo.UpdateProvider(ctx, alpha, ai.ProviderChanges{CatalogProviderID: &noCatalog}); err != nil {
			t.Fatal(err)
		}
		if must(env.Repo.GetProvider(ctx, alpha))(t).CatalogProviderID != nil {
			t.Fatal("catalog link must clear")
		}
		if ids := must(env.Repo.EnabledProviderIDs(ctx))(t); !slices.Equal(ids, []int{beta}) {
			t.Fatalf("enabled providers %v", ids)
		}
		expectError(t, env.Repo.UpdateProvider(ctx, 987654, ai.ProviderChanges{Name: ptr("x")}), ai.ErrProviderNotFound)
		_, err = env.Repo.GetProvider(ctx, 987654)
		expectError(t, err, ai.ErrProviderNotFound)
		_, err = env.Repo.ProviderConnection(ctx, 987654)
		expectError(t, err, ai.ErrProviderNotFound)
		expectError(t, env.Repo.DeleteProvider(ctx, 987654), ai.ErrProviderNotFound)
		if err := env.Repo.DeleteProvider(ctx, beta); err != nil {
			t.Fatal(err)
		}
		_, err = env.Repo.GetProvider(ctx, beta)
		expectError(t, err, ai.ErrProviderNotFound)
	})

	t.Run("provider summaries count routes by status", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		provider := createProvider(t, env.Repo, "summary")
		other := createProvider(t, env.Repo, "other")
		createRoute(t, env.Repo, createModel(t, env.Repo, "m1"), provider, 0)
		suspended := createRoute(t, env.Repo, createModel(t, env.Repo, "m2"), provider, 0)
		disabled := createRoute(t, env.Repo, createModel(t, env.Repo, "m3"), provider, 0)
		quota := createRoute(t, env.Repo, createModel(t, env.Repo, "m4"), provider, 0)
		must(env.Repo.SuspendRoute(ctx, suspended, ai.Failure{Kind: ai.ErrorQuota, Message: "no balance"}, contractTime))(t)
		must(env.Repo.SuspendRoute(ctx, quota, ai.Failure{Kind: ai.ErrorAuth, Message: "bad key"}, contractTime))(t)
		must(env.Repo.SetRouteStatus(ctx, []int{disabled}, ai.RouteDisabled, contractTime))(t)
		summaries := must(env.Repo.ListProviders(ctx))(t)
		if len(summaries) != 2 || summaries[0].ID != provider || summaries[1].ID != other {
			t.Fatalf("summaries %+v", summaries)
		}
		summary := summaries[0]
		if summary.Routes != (ai.RouteCounts{Total: 4, Active: 1, Suspended: 2, Disabled: 1}) ||
			!slices.Equal(summary.SuspendedKinds, []ai.ErrorKind{ai.ErrorAuth, ai.ErrorQuota}) || len(summary.UpstreamIDs) != 4 {
			t.Fatalf("summary %+v", summary)
		}
		if empty := summaries[1]; empty.Routes.Total != 0 || empty.SuspendedKinds == nil || empty.UpstreamIDs == nil {
			t.Fatalf("empty summary %+v", empty)
		}
	})

	t.Run("models keep unique keys and canonical ids", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		gpt := must(env.Repo.CreateModel(ctx, ai.NewModel{
			Key: "gpt-5", Name: "GPT-5", CanonicalID: ptr("openai/gpt-5"),
			Capabilities: ai.Capabilities{Temperature: true, Reasoning: true, ContextLimit: ptr(400000), OutputLimit: ptr(128000)},
		}))(t)
		_, err := env.Repo.CreateModel(ctx, ai.NewModel{Key: "gpt-5", Name: "Again"})
		expectError(t, err, ai.ErrModelTaken)
		_, err = env.Repo.CreateModel(ctx, ai.NewModel{Key: "gpt-5-copy", Name: "Copy", CanonicalID: ptr("openai/gpt-5")})
		expectError(t, err, ai.ErrModelTaken)
		claude := must(env.Repo.CreateModel(ctx, ai.NewModel{Key: "claude", Name: "Claude"}))(t)
		aardvark := must(env.Repo.CreateModel(ctx, ai.NewModel{Key: "aaa", Name: "Aardvark", Capabilities: ai.Capabilities{Moderation: true}}))(t)
		model := must(env.Repo.GetModel(ctx, gpt))(t)
		if model.Key != "gpt-5" || model.Name != "GPT-5" || *model.CanonicalID != "openai/gpt-5" || !model.Reasoning || *model.ContextLimit != 400000 ||
			*model.OutputLimit != 128000 || model.IsDefault || !model.Enabled {
			t.Fatalf("model %+v", model)
		}
		if err := env.Repo.UpdateModel(ctx, claude, ai.ModelChanges{IsDefault: ptr(true)}); err != nil {
			t.Fatal(err)
		}
		listed := must(env.Repo.ListModels(ctx))(t)
		if len(listed) != 3 || listed[0].ID != claude || listed[1].ID != aardvark || listed[2].ID != gpt {
			t.Fatalf("models are listed default first then by name: %+v", listed)
		}
		if id := must(env.Repo.DefaultModelID(ctx))(t); id == nil || *id != claude {
			t.Fatalf("default %v", id)
		}
		if err := env.Repo.ClearDefaultModel(ctx, aardvark); err != nil {
			t.Fatal(err)
		}
		if id := must(env.Repo.DefaultModelID(ctx))(t); id != nil {
			t.Fatalf("default cleared %v", *id)
		}
		if err := env.Repo.UpdateModel(ctx, claude, ai.ModelChanges{CanonicalID: ptr(ptr("anthropic/claude")), Description: ptr(ptr("writer"))}); err != nil {
			t.Fatal(err)
		}
		expectError(t, env.Repo.UpdateModel(ctx, aardvark, ai.ModelChanges{CanonicalID: ptr(ptr("anthropic/claude"))}), ai.ErrModelTaken)
		var none *string
		if err := env.Repo.UpdateModel(ctx, claude, ai.ModelChanges{
			Name: ptr("Claude 4"), Description: &none, Capabilities: &ai.Capabilities{Vision: true}, Enabled: ptr(false),
		}); err != nil {
			t.Fatal(err)
		}
		model = must(env.Repo.GetModel(ctx, claude))(t)
		if model.Name != "Claude 4" || model.Description != nil || *model.CanonicalID != "anthropic/claude" || !model.Vision || model.Temperature ||
			model.ContextLimit != nil || model.Enabled {
			t.Fatalf("updated model %+v", model)
		}
		_, err = env.Repo.GetModel(ctx, 987654)
		expectError(t, err, ai.ErrModelNotFound)
		expectError(t, env.Repo.UpdateModel(ctx, 987654, ai.ModelChanges{Name: ptr("x")}), ai.ErrModelNotFound)
		expectError(t, env.Repo.DeleteModel(ctx, 987654), ai.ErrModelNotFound)
	})

	t.Run("routes are ordered, unique and cascade with their model", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		first, second := createProvider(t, env.Repo, "first"), createProvider(t, env.Repo, "second")
		model := createModel(t, env.Repo, "gpt")
		tiered := must(env.Repo.CreateRoute(ctx, ai.NewRoute{
			ModelID: model, ProviderID: first, UpstreamID: "gpt-5", Protocol: ai.ProtocolChat, Priority: 1,
			Price: ai.Price{Input: 1.25, Output: 10, CacheRead: ptr(0.125), Tiers: []ai.PriceTier{{Over: 200000, Input: 2.5, Output: 20, CacheRead: ptr(0.25)}}},
		}))(t)
		plain := createRoute(t, env.Repo, model, second, 0)
		_, err := env.Repo.CreateRoute(ctx, ai.NewRoute{ModelID: model, ProviderID: first, UpstreamID: "dup", Protocol: ai.ProtocolChat})
		expectError(t, err, ai.ErrRouteTaken)
		_, err = env.Repo.CreateRoute(ctx, ai.NewRoute{ModelID: 987654, ProviderID: first, UpstreamID: "x", Protocol: ai.ProtocolChat})
		expectError(t, err, ai.ErrModelNotFound)
		_, err = env.Repo.CreateRoute(ctx, ai.NewRoute{ModelID: model, ProviderID: 987654, UpstreamID: "x", Protocol: ai.ProtocolChat})
		expectError(t, err, ai.ErrProviderNotFound)
		routes := must(env.Repo.ListRoutes(ctx, ai.RouteFilter{ModelID: &model}))(t)
		if !slices.Equal(routeIDs(routes), []int{plain, tiered}) {
			t.Fatalf("routes are ordered by priority: %v", routeIDs(routes))
		}
		route := routes[1]
		if route.Model.ID != model || route.Model.Key != "gpt" || route.Model.Name != "GPT" || route.Provider.ID != first || route.Provider.Name != "first" ||
			route.Provider.Kind != ai.KindCompatible || route.UpstreamID != "gpt-5" || route.Protocol != ai.ProtocolChat || route.Price.Input != 1.25 ||
			route.Price.Output != 10 || *route.Price.CacheRead != 0.125 || route.Price.CacheWrite != nil || len(route.Price.Tiers) != 1 ||
			route.Price.Tiers[0].Over != 200000 || *route.Price.Tiers[0].CacheRead != 0.25 || route.DroppedParams == nil || len(route.DroppedParams) != 0 ||
			route.Status != ai.RouteActive || route.StatusKind != nil || route.Adjustments == nil || route.Priority != 1 {
			t.Fatalf("route %+v", route)
		}
		if next := must(env.Repo.NextRoutePriority(ctx, model))(t); next != 2 {
			t.Fatalf("next priority %d", next)
		}
		if next := must(env.Repo.NextRoutePriority(ctx, createModel(t, env.Repo, "empty")))(t); next != 0 {
			t.Fatalf("first priority %d", next)
		}
		if err := env.Repo.SetRoutePriorities(ctx, []int{tiered, plain}); err != nil {
			t.Fatal(err)
		}
		if ids := routeIDs(must(env.Repo.ListRoutes(ctx, ai.RouteFilter{ModelID: &model}))(t)); !slices.Equal(ids, []int{tiered, plain}) {
			t.Fatalf("reordered %v", ids)
		}
		if err := env.Repo.UpdateRoute(ctx, tiered, ai.RouteChanges{
			UpstreamID: ptr("gpt-5-2025"), Protocol: ptr(ai.ProtocolResponses), PriceManual: ptr(true),
			Price: &ai.Price{Input: 3, Output: 4, CacheWrite: ptr(5.0)}, DroppedParams: &[]string{ai.ParamTemperature}, JSONMode: ptr(true),
		}); err != nil {
			t.Fatal(err)
		}
		route = must(env.Repo.GetRoute(ctx, tiered))(t)
		if route.UpstreamID != "gpt-5-2025" || route.Protocol != ai.ProtocolResponses || !route.PriceManual || route.Price.Input != 3 ||
			route.Price.CacheRead != nil || *route.Price.CacheWrite != 5 || len(route.Price.Tiers) != 0 ||
			!slices.Equal(route.DroppedParams, []string{ai.ParamTemperature}) || !route.JSONMode {
			t.Fatalf("updated route %+v", route)
		}
		if ids := routeIDs(must(env.Repo.ListRoutes(ctx, ai.RouteFilter{ProviderID: &second}))(t)); !slices.Equal(ids, []int{plain}) {
			t.Fatalf("provider filter %v", ids)
		}
		if ids := routeIDs(must(env.Repo.ListRoutes(ctx, ai.RouteFilter{IDs: []int{tiered}}))(t)); !slices.Equal(ids, []int{tiered}) {
			t.Fatalf("id filter %v", ids)
		}
		if routes := must(env.Repo.ListRoutes(ctx, ai.RouteFilter{IDs: []int{}}))(t); len(routes) != 0 {
			t.Fatalf("an empty id filter matches nothing: %v", routeIDs(routes))
		}
		suspended := ai.RouteSuspended
		if routes := must(env.Repo.ListRoutes(ctx, ai.RouteFilter{Status: &suspended}))(t); len(routes) != 0 {
			t.Fatalf("status filter %v", routeIDs(routes))
		}
		if count := must(env.Repo.DeleteRoutes(ctx, []int{plain, 987654}))(t); count != 1 {
			t.Fatalf("deleted %d", count)
		}
		if err := env.Repo.DeleteModel(ctx, model); err != nil {
			t.Fatal(err)
		}
		_, err = env.Repo.GetRoute(ctx, tiered)
		expectError(t, err, ai.ErrRouteNotFound)
		expectError(t, env.Repo.UpdateRoute(ctx, tiered, ai.RouteChanges{JSONMode: ptr(false)}), ai.ErrRouteNotFound)
	})

	t.Run("route health suspends active routes once and recovers them", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		provider, backup := createProvider(t, env.Repo, "main"), createProvider(t, env.Repo, "backup")
		model := createModel(t, env.Repo, "m")
		first, second := createRoute(t, env.Repo, model, provider, 0), createRoute(t, env.Repo, model, backup, 1)
		long := strings.Repeat("e", 600)
		if !must(env.Repo.SuspendRoute(ctx, first, ai.Failure{Kind: ai.ErrorAuth, Message: long}, contractTime))(t) {
			t.Fatal("active routes are suspended")
		}
		if must(env.Repo.SuspendRoute(ctx, first, ai.Failure{Kind: ai.ErrorQuota, Message: "again"}, contractTime))(t) {
			t.Fatal("suspended routes are not suspended twice")
		}
		route := must(env.Repo.GetRoute(ctx, first))(t)
		if route.Status != ai.RouteSuspended || *route.StatusKind != ai.ErrorAuth || len([]rune(*route.StatusMessage)) != 500 || !route.StatusAt.Equal(contractTime) {
			t.Fatalf("suspended route %+v", route)
		}
		must(env.Repo.SuspendRoute(ctx, second, ai.Failure{Kind: ai.ErrorQuota, Message: "quota"}, contractTime.Add(time.Second)))(t)
		if ids := must(env.Repo.SuspendedRouteIDs(ctx))(t); !slices.Equal(ids, []int{first, second}) {
			t.Fatalf("suspended %v", ids)
		}
		if err := env.Repo.UpdateProvider(ctx, backup, ai.ProviderChanges{Enabled: ptr(false)}); err != nil {
			t.Fatal(err)
		}
		if ids := must(env.Repo.SuspendedRouteIDs(ctx))(t); !slices.Equal(ids, []int{first}) {
			t.Fatalf("disabled providers are not probed: %v", ids)
		}
		if !must(env.Repo.RecoverRoute(ctx, first, contractTime))(t) || must(env.Repo.RecoverRoute(ctx, first, contractTime))(t) {
			t.Fatal("recover only changes suspended routes")
		}
		if route = must(env.Repo.GetRoute(ctx, first))(t); route.Status != ai.RouteActive || route.StatusKind != nil || route.StatusMessage != nil {
			t.Fatalf("recovered %+v", route)
		}
		if count := must(env.Repo.SetRouteStatus(ctx, []int{first, second, 987654}, ai.RouteDisabled, contractTime))(t); count != 2 {
			t.Fatalf("status count %d", count)
		}
		if route = must(env.Repo.GetRoute(ctx, second))(t); route.Status != ai.RouteDisabled || route.StatusKind != nil || route.StatusMessage != nil {
			t.Fatalf("disabled %+v", route)
		}
		if must(env.Repo.SuspendRoute(ctx, first, ai.Failure{Kind: ai.ErrorAuth}, contractTime))(t) || must(env.Repo.RecoverRoute(ctx, first, contractTime))(t) {
			t.Fatal("disabled routes are neither suspended nor recovered")
		}
	})

	t.Run("adjustments are upserted per kind and value", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		model := createModel(t, env.Repo, "m")
		route := createRoute(t, env.Repo, model, createProvider(t, env.Repo, "p"), 0)
		other := createRoute(t, env.Repo, model, createProvider(t, env.Repo, "q"), 1)
		if err := env.Repo.SaveAdjustments(ctx, route, []ai.NewAdjustment{
			{Kind: ai.AdjustProtocol, Value: "responses", Previous: ptr("chat"), ErrorKind: ai.ErrorProtocol},
			{Kind: ai.AdjustParam, Value: ai.ParamTemperature, ErrorKind: ai.ErrorParam},
		}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SaveAdjustments(ctx, route, []ai.NewAdjustment{{Kind: ai.AdjustParam, Value: ai.ParamTemperature, ErrorKind: ai.ErrorOther}}); err != nil {
			t.Fatal(err)
		}
		adjustments := must(env.Repo.GetRoute(ctx, route))(t).Adjustments
		if len(adjustments) != 2 || adjustments[0].Kind != ai.AdjustParam || adjustments[0].ErrorKind != ai.ErrorOther ||
			adjustments[1].Kind != ai.AdjustProtocol || *adjustments[1].Previous != "chat" || adjustments[1].Value != "responses" {
			t.Fatalf("adjustments %+v", adjustments)
		}
		protocol, param := adjustments[1].ID, adjustments[0].ID
		expectError(t, env.Repo.DeleteAdjustment(ctx, other, param), ai.ErrAdjustmentNotFound)
		if err := env.Repo.DeleteAdjustment(ctx, route, protocol); err != nil {
			t.Fatal(err)
		}
		expectError(t, env.Repo.DeleteAdjustment(ctx, route, protocol), ai.ErrAdjustmentNotFound)
		if err := env.Repo.DeleteAdjustmentsOfKind(ctx, route, ai.AdjustParam); err != nil {
			t.Fatal(err)
		}
		if left := must(env.Repo.GetRoute(ctx, route))(t).Adjustments; len(left) != 0 {
			t.Fatalf("left %+v", left)
		}
		expectError(t, env.Repo.SaveAdjustments(ctx, 987654, []ai.NewAdjustment{{Kind: ai.AdjustJSONMode, Value: "json", ErrorKind: ai.ErrorStructured}}), ai.ErrRouteNotFound)
	})

	t.Run("offers are replaced per provider and filtered", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		first, second := createProvider(t, env.Repo, "first"), createProvider(t, env.Repo, "second")
		synced := contractTime
		if err := env.Repo.ReplaceOffers(ctx, first, []ai.Offer{
			{UpstreamID: "b", SyncedAt: synced},
			{UpstreamID: "a", Name: ptr("Model A"), Protocols: []ai.Protocol{ai.ProtocolChat, ai.ProtocolResponses}, CanonicalID: ptr("lab/a"), SyncedAt: synced},
			{UpstreamID: "a", Name: ptr("duplicate"), SyncedAt: synced},
		}); err != nil {
			t.Fatal(err)
		}
		offers := must(env.Repo.ListOffers(ctx, ai.OfferFilter{ProviderIDs: []int{first}}))(t)
		if len(offers) != 2 || offers[0].UpstreamID != "a" || *offers[0].Name != "Model A" || offers[0].ProviderID != first ||
			!slices.Equal(offers[0].Protocols, []ai.Protocol{ai.ProtocolChat, ai.ProtocolResponses}) || *offers[0].CanonicalID != "lab/a" ||
			!offers[0].SyncedAt.Equal(synced) || offers[1].UpstreamID != "b" {
			t.Fatalf("offers %+v", offers)
		}
		if err := env.Repo.ReplaceOffers(ctx, first, []ai.Offer{{UpstreamID: "c", SyncedAt: synced}}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.ReplaceOffers(ctx, second, []ai.Offer{{UpstreamID: "a", CanonicalID: ptr("lab/a"), SyncedAt: synced}}); err != nil {
			t.Fatal(err)
		}
		all := must(env.Repo.ListOffers(ctx, ai.OfferFilter{}))(t)
		if len(all) != 2 || all[0].ProviderID != first || all[0].UpstreamID != "c" || all[1].ProviderID != second {
			t.Fatalf("replaced offers %+v", all)
		}
		if found := must(env.Repo.ListOffers(ctx, ai.OfferFilter{WithCanonical: true}))(t); len(found) != 1 || found[0].ProviderID != second {
			t.Fatalf("canonical offers %+v", found)
		}
		if found := must(env.Repo.ListOffers(ctx, ai.OfferFilter{CanonicalIDs: []string{"lab/a"}, UpstreamIDs: []string{"a"}}))(t); len(found) != 1 {
			t.Fatalf("filtered offers %+v", found)
		}
		if err := env.Repo.UpdateProvider(ctx, second, ai.ProviderChanges{Enabled: ptr(false)}); err != nil {
			t.Fatal(err)
		}
		if found := must(env.Repo.ListOffers(ctx, ai.OfferFilter{EnabledOnly: true}))(t); len(found) != 1 || found[0].ProviderID != first {
			t.Fatalf("enabled offers %+v", found)
		}
		expectError(t, env.Repo.ReplaceOffers(ctx, 987654, nil), ai.ErrProviderNotFound)
		if err := env.Repo.DeleteProvider(ctx, first); err != nil {
			t.Fatal(err)
		}
		if found := must(env.Repo.ListOffers(ctx, ai.OfferFilter{ProviderIDs: []int{first}}))(t); len(found) != 0 {
			t.Fatalf("offers follow their provider: %+v", found)
		}
	})

	t.Run("scenes store their settings and model usability", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		model := createModel(t, env.Repo, "m")
		enabled, disabled, third := createProvider(t, env.Repo, "on"), createProvider(t, env.Repo, "off"), createProvider(t, env.Repo, "third")
		createRoute(t, env.Repo, model, enabled, 0)
		createRoute(t, env.Repo, model, disabled, 1)
		paused := createRoute(t, env.Repo, model, third, 2)
		must(env.Repo.SetRouteStatus(ctx, []int{paused}, ai.RouteDisabled, contractTime))(t)
		if err := env.Repo.UpdateProvider(ctx, disabled, ai.ProviderChanges{Enabled: ptr(false)}); err != nil {
			t.Fatal(err)
		}
		timeout := 90 * time.Second
		config := ai.SceneConfig{Key: "moderation_review", ModelID: &model, Temperature: ptr(0.2), MaxOutputTokens: ptr(1000), Timeout: &timeout}
		if err := env.Repo.SaveSceneConfig(ctx, config); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SaveSceneConfig(ctx, ai.SceneConfig{Key: "a_scene"}); err != nil {
			t.Fatal(err)
		}
		saved, found := must2(env.Repo.SceneConfig(ctx, "moderation_review"))(t)
		if !found || *saved.ModelID != model || *saved.Temperature != 0.2 || *saved.MaxOutputTokens != 1000 || *saved.Timeout != timeout {
			t.Fatalf("scene %+v", saved)
		}
		if configs := must(env.Repo.ListSceneConfigs(ctx))(t); len(configs) != 2 || configs[0].Key != "a_scene" || configs[1].Key != "moderation_review" {
			t.Fatalf("scenes %+v", configs)
		}
		if _, found := must2(env.Repo.SceneConfig(ctx, "unknown"))(t); found {
			t.Fatal("unknown scenes are not found")
		}
		models := must(env.Repo.SceneModels(ctx, []int{model, 987654}))(t)
		if len(models) != 1 || models[0].ID != model || models[0].Key != "m" || !models[0].Enabled || models[0].ActiveRoutes != 1 {
			t.Fatalf("scene models %+v", models)
		}
		expectError(t, env.Repo.SaveSceneConfig(ctx, ai.SceneConfig{Key: "broken", ModelID: ptr(987654)}), ai.ErrModelNotFound)
		if err := env.Repo.DeleteModel(ctx, model); err != nil {
			t.Fatal(err)
		}
		if saved, _ = must2(env.Repo.SceneConfig(ctx, "moderation_review"))(t); saved.ModelID != nil || *saved.Temperature != 0.2 {
			t.Fatalf("deleting a model unlinks its scenes: %+v", saved)
		}
		if err := env.Repo.SaveSceneConfig(ctx, ai.SceneConfig{Key: "moderation_review"}); err != nil {
			t.Fatal(err)
		}
		if saved, _ = must2(env.Repo.SceneConfig(ctx, "moderation_review"))(t); saved.Temperature != nil || saved.MaxOutputTokens != nil || saved.Timeout != nil {
			t.Fatalf("saving replaces every setting: %+v", saved)
		}
	})

	t.Run("targets expose usable routes with opened keys", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		model := must(env.Repo.CreateModel(ctx, ai.NewModel{Key: "m", Name: "M", Capabilities: ai.Capabilities{Temperature: true, OutputLimit: ptr(4096)}}))(t)
		late, off, early := createProvider(t, env.Repo, "late"), createProvider(t, env.Repo, "off"), createProvider(t, env.Repo, "early")
		lateRoute := createRoute(t, env.Repo, model, late, 1)
		createRoute(t, env.Repo, model, off, 0)
		earlyRoute := createRoute(t, env.Repo, model, early, 0)
		if err := env.Repo.UpdateProvider(ctx, off, ai.ProviderChanges{Enabled: ptr(false)}); err != nil {
			t.Fatal(err)
		}
		target, routes, err := env.Repo.ModelTarget(ctx, model)
		if err != nil {
			t.Fatal(err)
		}
		if target != (ai.ModelTarget{ID: model, Key: "m", Name: "M", Temperature: true, OutputLimit: target.OutputLimit, Enabled: true}) || *target.OutputLimit != 4096 {
			t.Fatalf("model target %+v", target)
		}
		if len(routes) != 2 || routes[0].ID != earlyRoute || routes[1].ID != lateRoute || routes[0].ProviderID != early || routes[0].ProviderName != "early" ||
			routes[0].Connection.APIKey != "sk-early-0123456789abcdef" || routes[0].Connection.Kind != ai.KindCompatible || routes[0].Price.Output != 2 ||
			routes[0].DroppedParams == nil {
			t.Fatalf("route targets %+v", routes)
		}
		must(env.Repo.SuspendRoute(ctx, earlyRoute, ai.Failure{Kind: ai.ErrorAuth}, contractTime))(t)
		if _, routes, _ = env.Repo.ModelTarget(ctx, model); len(routes) != 1 || routes[0].ID != lateRoute {
			t.Fatalf("suspended routes are skipped: %+v", routes)
		}
		routeModel, route, err := env.Repo.RouteTarget(ctx, earlyRoute)
		if err != nil || routeModel.ID != model || route.ID != earlyRoute || route.Connection.APIKey != "sk-early-0123456789abcdef" {
			t.Fatalf("route target %+v %+v %v", routeModel, route, err)
		}
		_, _, err = env.Repo.ModelTarget(ctx, 987654)
		expectError(t, err, ai.ErrModelNotFound)
		_, _, err = env.Repo.RouteTarget(ctx, 987654)
		expectError(t, err, ai.ErrRouteNotFound)
	})

	t.Run("super admins receive gateway notices", func(t *testing.T) {
		env := newEnv(t)
		first, second := env.SuperAdmin(t), env.SuperAdmin(t)
		if ids := must(env.Repo.SuperAdminIDs(t.Context()))(t); !slices.Equal(ids, []int{first, second}) {
			t.Fatalf("super admins %v, want %v", ids, []int{first, second})
		}
	})
}

func must2[A, B any](a A, b B, err error) func(t *testing.T) (A, B) {
	return func(t *testing.T) (A, B) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		return a, b
	}
}
