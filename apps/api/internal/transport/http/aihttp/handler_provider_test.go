package aihttp_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestProviderRoutesRequireAdminsAndSuperAdminsForChanges(t *testing.T) {
	f := setup(t)
	body := map[string]any{"kind": "openai", "name": "OpenAI", "api_key": "sk-test-0123456789abcdef"}
	f.expect(f.do(http.MethodGet, "/admin/ai/providers", nil, nil), http.StatusUnauthorized, 200101)
	f.expect(f.do(http.MethodGet, "/admin/ai/providers", &member, nil), http.StatusForbidden, http.StatusForbidden)
	f.expect(f.do(http.MethodGet, "/admin/ai/providers", &admin, nil), http.StatusOK, 0)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &admin, body), http.StatusForbidden, http.StatusForbidden)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, body), http.StatusCreated, 0)
}

func TestProviderCreateNeverReturnsTheKey(t *testing.T) {
	f := setup(t)
	resp := f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "compatible", "name": "Relay", "base_url": "https://relay.test/v1/", "api_key": "sk-relay-secret-0123456789", "price_multiplier": 1.5})
	f.expect(resp, http.StatusCreated, 0)
	if strings.Contains(string(resp.Body), "sk-relay-secret-0123456789") {
		t.Fatalf("the key leaked: %s", resp.Body)
	}
	var created struct {
		ID              int      `json:"id"`
		Name            string   `json:"name"`
		Kind            string   `json:"kind"`
		BaseURL         *string  `json:"base_url"`
		KeyHint         string   `json:"key_hint"`
		PriceMultiplier float64  `json:"price_multiplier"`
		Enabled         bool     `json:"enabled"`
		Protocols       []string `json:"protocols"`
		RouteCounts     struct {
			Total int `json:"total"`
		} `json:"route_counts"`
		Routes []any `json:"routes"`
	}
	f.decode(resp, &created)
	if created.Name != "Relay" || created.Kind != "compatible" || created.BaseURL == nil || *created.BaseURL != "https://relay.test/v1" ||
		created.KeyHint != "sk-…6789" || created.PriceMultiplier != 1.5 || !created.Enabled || len(created.Protocols) != 5 || created.RouteCounts.Total != 0 || created.Routes == nil {
		t.Fatalf("created %s", resp.Data)
	}
	list := f.do(http.MethodGet, "/admin/ai/providers", &admin, nil)
	f.expect(list, http.StatusOK, 0)
	if strings.Contains(string(list.Body), "sk-relay-secret") || !strings.Contains(string(list.Data), `"key_hint":"sk-…6789"`) {
		t.Fatalf("list %s", list.Data)
	}
}

func TestProviderValidation(t *testing.T) {
	f := setup(t)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "azure", "name": "x", "api_key": "k"}), http.StatusUnprocessableEntity, 100101)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "compatible", "name": "x", "api_key": "k"}), http.StatusUnprocessableEntity, 630103)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "compatible", "name": "x", "base_url": "  ", "api_key": "k"}), http.StatusUnprocessableEntity, 630103)
	f.openAIProvider()
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "openai", "name": "OpenAI", "api_key": "k"}), http.StatusConflict, 630102)
	f.expect(f.do(http.MethodPost, "/admin/ai/providers", &superAdmin, map[string]any{"kind": "openai", "name": "Other", "api_key": "k", "catalog_provider_id": "missing"}), http.StatusNotFound, 630123)
	f.expect(f.do(http.MethodGet, "/admin/ai/providers/99", &admin, nil), http.StatusNotFound, 630101)
}

func TestProviderUpdateAndDelete(t *testing.T) {
	f := setup(t)
	id := f.createProvider(map[string]any{"kind": "openai", "name": "OpenAI", "base_url": "https://proxy.test/v1", "api_key": "sk-test-0123456789abcdef"})
	resp := f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/providers/%d", id), &superAdmin, map[string]any{"base_url": nil, "name": "OpenAI Direct", "enabled": false, "api_key": "sk-rotated-key-abcdefghij"})
	f.expect(resp, http.StatusOK, 0)
	var updated struct {
		Name    string  `json:"name"`
		BaseURL *string `json:"base_url"`
		Enabled bool    `json:"enabled"`
		KeyHint string  `json:"key_hint"`
	}
	f.decode(resp, &updated)
	if updated.Name != "OpenAI Direct" || updated.BaseURL != nil || updated.Enabled || updated.KeyHint != "sk-…ghij" {
		t.Fatalf("updated %s", resp.Data)
	}
	untouched := f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/providers/%d", id), &superAdmin, map[string]any{"price_multiplier": 2})
	f.expect(untouched, http.StatusOK, 0)
	if !strings.Contains(string(untouched.Data), `"base_url":null`) || !strings.Contains(string(untouched.Data), `"name":"OpenAI Direct"`) {
		t.Fatalf("omitted fields stay as they are: %s", untouched.Data)
	}
	f.expect(f.do(http.MethodPatch, fmt.Sprintf("/admin/ai/providers/%d", id), &superAdmin, map[string]any{"kind": "compatible"}), http.StatusUnprocessableEntity, 630103)
	deleted := f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/providers/%d", id), &superAdmin, nil)
	f.expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("delete returns no data: %s", deleted.Body)
	}
	f.expect(f.do(http.MethodDelete, fmt.Sprintf("/admin/ai/providers/%d", id), &superAdmin, nil), http.StatusNotFound, 630101)
}

func TestProviderEndpointPreview(t *testing.T) {
	f := setup(t)
	resp := f.do(http.MethodGet, "/admin/ai/providers/endpoint?kind=compatible&base_url=https://relay.test/v1/", &admin, nil)
	f.expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"url":"https://relay.test/v1/chat"}` {
		t.Fatalf("endpoint %s", resp.Data)
	}
	missing := f.do(http.MethodGet, "/admin/ai/providers/endpoint?kind=compatible", &admin, nil)
	f.expect(missing, http.StatusOK, 0)
	if string(missing.Data) != `{"url":null}` {
		t.Fatalf("compatible providers need a base URL: %s", missing.Data)
	}
	f.expect(f.do(http.MethodGet, "/admin/ai/providers/endpoint", &admin, nil), http.StatusUnprocessableEntity, 100101)
}

func TestProviderDiscoveryAndRoutes(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	id := f.openAIProvider()
	f.upstream.models = []ai.UpstreamModel{{ID: "gpt-5-mini"}, {ID: "omni-moderation-latest"}}
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", id), &admin, nil), http.StatusForbidden, http.StatusForbidden)
	resp := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", id), &superAdmin, nil)
	f.expect(resp, http.StatusOK, 0)
	var discovery struct {
		Error  *struct{} `json:"error"`
		Models []struct {
			UpstreamID  string   `json:"upstream_id"`
			Name        string   `json:"name"`
			CanonicalID *string  `json:"canonical_id"`
			Protocol    string   `json:"protocol"`
			Protocols   []string `json:"protocols"`
			Moderation  bool     `json:"moderation"`
			InputPrice  *float64 `json:"input_price"`
			ModelID     *int     `json:"model_id"`
			RouteID     *int     `json:"route_id"`
		} `json:"models"`
	}
	f.decode(resp, &discovery)
	if discovery.Error != nil || len(discovery.Models) != 2 {
		t.Fatalf("discovery %s", resp.Data)
	}
	byID := map[string]int{}
	for i, model := range discovery.Models {
		byID[model.UpstreamID] = i
	}
	gpt, moderation := discovery.Models[byID["gpt-5-mini"]], discovery.Models[byID["omni-moderation-latest"]]
	if gpt.Name != "GPT-5 mini" || gpt.CanonicalID == nil || *gpt.CanonicalID != "openai/gpt-5-mini" || gpt.Protocol != "responses" || gpt.InputPrice == nil || *gpt.InputPrice != 0.25 || gpt.ModelID != nil || gpt.RouteID != nil {
		t.Fatalf("gpt %+v", gpt)
	}
	if !moderation.Moderation || moderation.Protocol != "moderation" {
		t.Fatalf("moderation %+v", moderation)
	}
	routeIDs := f.addRoutes(id, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "chat"}, map[string]any{"upstream_id": "omni-moderation-latest", "protocol": "chat"})
	if len(routeIDs) != 2 {
		t.Fatalf("routes %v", routeIDs)
	}
	again := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/routes", id), &superAdmin, map[string]any{"items": []map[string]any{{"upstream_id": "gpt-5-mini", "protocol": "responses"}}})
	f.expect(again, http.StatusOK, 0)
	if string(again.Data) != `{"route_ids":[],"skipped":["gpt-5-mini"]}` {
		t.Fatalf("existing routes are skipped: %s", again.Data)
	}
	gptRoute, moderationRoute := f.route(routeIDs[0]), f.route(routeIDs[1])
	if gptRoute.Protocol != "responses" || gptRoute.Model.Key != "gpt-5-mini" || gptRoute.InputPrice != 0.25 || gptRoute.Offered == nil || !*gptRoute.Offered {
		t.Fatalf("gpt route %+v", gptRoute)
	}
	if moderationRoute.Protocol != "moderation" || !moderationRoute.Model.Moderation {
		t.Fatalf("moderation route %+v", moderationRoute)
	}
	rediscovered := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", id), &superAdmin, nil)
	f.expect(rediscovered, http.StatusOK, 0)
	if !strings.Contains(string(rediscovered.Data), fmt.Sprintf(`"model_id":%d,"route_id":%d`, gptRoute.Model.ID, gptRoute.ID)) {
		t.Fatalf("discovery links existing routes: %s", rediscovered.Data)
	}
	resolved := f.do(http.MethodGet, fmt.Sprintf("/admin/ai/providers/%d/resolve?ids=gpt-5-mini,unknown-model", id), &admin, nil)
	f.expect(resolved, http.StatusOK, 0)
	want := fmt.Sprintf(`[{"upstream_id":"gpt-5-mini","model_id":%d,"model_name":"GPT-5 mini","canonical_id":"openai/gpt-5-mini","catalog_name":"GPT-5 mini"},{"upstream_id":"unknown-model","model_id":null,"model_name":null,"canonical_id":null,"catalog_name":null}]`, gptRoute.Model.ID)
	if string(resolved.Data) != want {
		t.Fatalf("resolve %s", resolved.Data)
	}
	detail := f.do(http.MethodGet, fmt.Sprintf("/admin/ai/providers/%d", id), &admin, nil)
	f.expect(detail, http.StatusOK, 0)
	if !strings.Contains(string(detail.Data), `"route_counts":{"total":2,"active":2,"suspended":0,"disabled":0}`) || !strings.Contains(string(detail.Data), `"routes":[{`) {
		t.Fatalf("provider detail %s", detail.Data)
	}
}

func TestProviderDiscoveryReportsUpstreamFailures(t *testing.T) {
	f := setup(t)
	id := f.openAIProvider()
	f.upstream.listErr = &ai.Failure{Kind: ai.ErrorAuth, Message: "HTTP 401 · invalid api key", Detail: "401 https://api.openai.com/v1/models"}
	resp := f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", id), &superAdmin, nil)
	f.expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"error":{"kind":"auth","message":"HTTP 401 · invalid api key","detail":"401 https://api.openai.com/v1/models"},"models":[]}` {
		t.Fatalf("discovery failure %s", resp.Data)
	}
}
