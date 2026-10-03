package aihttp_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type modelShape struct {
	ID           int          `json:"id"`
	Key          string       `json:"key"`
	Name         string       `json:"name"`
	Description  *string      `json:"description"`
	CanonicalID  *string      `json:"canonical_id"`
	Vision       bool         `json:"vision"`
	Moderation   bool         `json:"moderation"`
	Reasoning    bool         `json:"reasoning"`
	ContextLimit *int         `json:"context_limit"`
	IsDefault    bool         `json:"is_default"`
	Enabled      bool         `json:"enabled"`
	Routes       []routeShape `json:"routes"`
	Scenes       []struct {
		Key  string `json:"key"`
		Role string `json:"role"`
	} `json:"scenes"`
	Stats struct {
		Requests int `json:"requests"`
	} `json:"stats"`
}

func (f *fixture) createModel(body map[string]any) modelShape {
	f.t.Helper()
	resp := f.do(http.MethodPost, "/admin/ai/models", &superAdmin, body)
	f.expect(resp, http.StatusCreated, 0)
	var model modelShape
	f.decode(resp, &model)
	return model
}

func TestModelCreateFromTheCatalog(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	openai := f.openAIProvider()
	relay := f.createProvider(map[string]any{"kind": "compatible", "name": "Relay", "base_url": "https://relay.test/v1", "api_key": "sk-relay-0123456789", "catalog_provider_id": "relay"})
	f.expect(f.do(http.MethodPost, "/admin/ai/models", &admin, map[string]any{"canonical_id": "openai/gpt-5-mini", "name": "GPT", "routes": []any{}}), http.StatusForbidden, http.StatusForbidden)
	f.expect(f.do(http.MethodPost, "/admin/ai/models", &superAdmin, map[string]any{"canonical_id": "lab/unknown", "name": "x", "routes": []any{}}), http.StatusNotFound, 630113)
	f.expect(f.do(http.MethodPost, "/admin/ai/models", &superAdmin, map[string]any{"canonical_id": "openai/gpt-5-mini", "name": "x", "routes": []map[string]any{
		{"provider_id": openai, "upstream_id": "gpt-5-mini", "protocol": "responses"},
		{"provider_id": openai, "upstream_id": "gpt-5-mini", "protocol": "responses"},
	}}), http.StatusUnprocessableEntity, 630110)
	model := f.createModel(map[string]any{"canonical_id": "openai/gpt-5-mini", "name": "GPT-5 mini", "description": "review model", "routes": []map[string]any{
		{"provider_id": relay, "upstream_id": "gpt-5-mini", "protocol": "chat"},
		{"provider_id": openai, "upstream_id": "gpt-5-mini", "protocol": "chat"},
	}})
	if model.Key != "gpt-5-mini" || model.Name != "GPT-5 mini" || model.Description == nil || *model.Description != "review model" ||
		model.CanonicalID == nil || *model.CanonicalID != "openai/gpt-5-mini" || !model.Vision || !model.Reasoning || model.ContextLimit == nil || *model.ContextLimit != 400000 || !model.Enabled {
		t.Fatalf("model %+v", model)
	}
	if len(model.Routes) != 2 || model.Routes[0].Provider.ID != relay || model.Routes[0].Protocol != "chat" || model.Routes[1].Provider.ID != openai || model.Routes[1].Protocol != "responses" {
		t.Fatalf("routes follow the request order and provider protocols: %+v", model.Routes)
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/models", &superAdmin, map[string]any{"canonical_id": "openai/gpt-5-mini", "name": "again", "routes": []any{}}), http.StatusConflict, 630105)
	f.expect(f.do(http.MethodGet, "/admin/ai/models/99", &admin, nil), http.StatusNotFound, 630104)
}

func TestModelListShowsRoutesStatsAndScenes(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	id := f.openAIProvider()
	f.upstream.models = []ai.UpstreamModel{{ID: "gpt-5-mini"}}
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", id), &superAdmin, nil), http.StatusOK, 0)
	routeIDs := f.addRoutes(id, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "responses"})
	route := f.route(routeIDs[0])
	f.stats.GroupedStats[ai.DimensionRoute] = map[string]ai.Stats{fmt.Sprint(route.ID): {Requests: 3, Failures: 1, CostUSD: 0.02}}
	f.stats.GroupedStats[ai.DimensionModel] = map[string]ai.Stats{fmt.Sprint(route.Model.ID): {Requests: 7}}
	f.stats.Latest[route.ID] = ai.LastAttempt{ID: 42, OK: true, Created: time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)}
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", route.Model.ID), &superAdmin, map[string]any{"is_default": true}), http.StatusOK, 0)
	resp := f.do(http.MethodGet, "/admin/ai/models", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	var models []modelShape
	f.decode(resp, &models)
	if len(models) != 1 || !models[0].IsDefault || models[0].Stats.Requests != 7 || len(models[0].Routes) != 1 || len(models[0].Scenes) != 2 || models[0].Scenes[0].Role != "default" {
		t.Fatalf("models %s", resp.Data)
	}
	listed := models[0].Routes[0]
	if listed.Stats.Requests != 3 || listed.Last == nil || listed.Last.ID != "42" || !listed.Last.OK || listed.Offered == nil || !*listed.Offered {
		t.Fatalf("route view %s", resp.Data)
	}
	for _, field := range []string{`"last":{"id":"42","ok":true,"created":"2026-10-03T00:00:00.000Z","first_token_ms":null,"error":null}`, `"stats":{"requests":3,"failures":1,"first_token_ms":null,"cost_usd":0.02}`, `"adjustments":[]`, `"dropped_params":[]`} {
		if !strings.Contains(string(resp.Data), field) {
			t.Fatalf("missing %s in %s", field, resp.Data)
		}
	}
}

func TestModelUpdateReorderAddRouteAndDelete(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	openai := f.openAIProvider()
	relay := f.createProvider(map[string]any{"kind": "compatible", "name": "Relay", "base_url": "https://relay.test/v1", "api_key": "sk-relay-0123456789"})
	model := f.createModel(map[string]any{"canonical_id": "openai/gpt-5-mini", "name": "GPT-5 mini", "routes": []map[string]any{{"provider_id": openai, "upstream_id": "gpt-5-mini", "protocol": "responses"}}})
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, map[string]any{"vision": false}), http.StatusUnprocessableEntity, 630120)
	renamed := f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, map[string]any{"name": "Mini", "description": nil, "enabled": false})
	f.expect(renamed, http.StatusOK, 0)
	if !strings.Contains(string(renamed.Data), `"name":"Mini"`) || !strings.Contains(string(renamed.Data), `"enabled":false`) {
		t.Fatalf("renamed %s", renamed.Data)
	}
	added := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/models/%d/routes", model.ID), &superAdmin, map[string]any{"provider_id": relay, "upstream_id": "gpt-5-mini", "protocol": "chat", "price_manual": true, "input_price": 1, "output_price": 3})
	f.expect(added, http.StatusCreated, 0)
	var route routeShape
	f.decode(added, &route)
	if route.Protocol != "chat" || route.InputPrice != 1 || route.Provider.ID != relay {
		t.Fatalf("added route %s", added.Data)
	}
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/models/%d/routes", model.ID), &superAdmin, map[string]any{"provider_id": relay, "upstream_id": "other", "protocol": "chat"}), http.StatusConflict, 630108)
	first := model.Routes[0].ID
	f.expect(f.do(http.MethodPut, fmt.Sprintf("/admin/ai/models/%d/routes", model.ID), &superAdmin, map[string]any{"ids": []int{first}}), http.StatusUnprocessableEntity, 630110)
	reordered := f.do(http.MethodPut, fmt.Sprintf("/admin/ai/models/%d/routes", model.ID), &superAdmin, map[string]any{"ids": []int{route.ID, first}})
	f.expect(reordered, http.StatusOK, 0)
	var after modelShape
	f.decode(reordered, &after)
	if len(after.Routes) != 2 || after.Routes[0].ID != route.ID || after.Routes[1].ID != first {
		t.Fatalf("reordered %s", reordered.Data)
	}
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, map[string]any{"is_default": true}), http.StatusOK, 0)
	f.expect(f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, nil), http.StatusConflict, 630106)
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, map[string]any{"is_default": false}), http.StatusOK, 0)
	f.expect(f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/models/%d", model.ID), &superAdmin, nil), http.StatusOK, 0)
	f.expect(f.do(http.MethodGet, fmt.Sprintf("/admin/ai/routes/%d", first), &admin, nil), http.StatusNotFound, 630107)
}
