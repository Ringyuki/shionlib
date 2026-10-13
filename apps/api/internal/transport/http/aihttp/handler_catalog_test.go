package aihttp_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestCatalogSyncAndStatus(t *testing.T) {
	f := setup(t)
	status := f.do(http.MethodGet, "/admin/ai/catalog", &admin, nil)
	f.expect(status, http.StatusOK, 0)
	if string(status.Data) != `{"providers":0,"models":0,"synced_at":null}` {
		t.Fatalf("empty status %s", status.Data)
	}
	f.expect(f.do(http.MethodPost, "/admin/ai/catalog/sync", &admin, nil), http.StatusForbidden, http.StatusForbidden)
	synced := f.do(http.MethodPost, "/admin/ai/catalog/sync", &superAdmin, nil)
	f.expect(synced, http.StatusOK, 0)
	if string(synced.Data) != `{"providers":2,"models":3,"added":3,"updated":0,"removed":0,"repriced":0}` {
		t.Fatalf("sync %s", synced.Data)
	}
	again := f.do(http.MethodPost, "/admin/ai/catalog/sync", &superAdmin, nil)
	f.expect(again, http.StatusOK, 0)
	if string(again.Data) != `{"providers":2,"models":3,"added":0,"updated":0,"removed":0,"repriced":0}` {
		t.Fatalf("second sync %s", again.Data)
	}
	status = f.do(http.MethodGet, "/admin/ai/catalog", &admin, nil)
	f.expect(status, http.StatusOK, 0)
	if string(status.Data) != `{"providers":2,"models":3,"synced_at":"2026-10-03T01:02:03.000Z"}` {
		t.Fatalf("status %s", status.Data)
	}
	providers := f.do(http.MethodGet, "/admin/ai/catalog/providers", &admin, nil)
	f.expect(providers, http.StatusOK, 0)
	if string(providers.Data) != `[{"id":"openai","name":"OpenAI","kind":"openai","base_url":null,"doc_url":null,"models":2},{"id":"relay","name":"Relay","kind":"compatible","base_url":"https://relay.test/v1","doc_url":null,"models":1}]` {
		t.Fatalf("providers %s", providers.Data)
	}
}

func TestCatalogModelsListOffers(t *testing.T) {
	f := setup(t)
	f.syncCatalog()
	searched := f.do(http.MethodGet, "/admin/ai/catalog/models?q=mini", &admin, nil)
	f.expect(searched, http.StatusOK, 0)
	if string(searched.Data) != `[{"canonical_id":"openai/gpt-5-mini","name":"GPT-5 mini","lab":"openai","vision":true,"moderation":false,"temperature":false,"tool_call":false,"reasoning":true,"context_limit":400000,"output_limit":128000,"input_price":0.25,"output_price":2,"model_id":null,"offers":[]}]` {
		t.Fatalf("search %s", searched.Data)
	}
	empty := f.do(http.MethodGet, "/admin/ai/catalog/models", &admin, nil)
	f.expect(empty, http.StatusOK, 0)
	if string(empty.Data) != `[]` {
		t.Fatalf("without offers the default listing is empty: %s", empty.Data)
	}
	provider := f.openAIProvider()
	f.upstream.models = []ai.UpstreamModel{{ID: "gpt-5-mini"}}
	f.expect(f.do(http.MethodPost, fmt.Sprintf("/admin/ai/providers/%d/discovery", provider), &superAdmin, nil), http.StatusOK, 0)
	route := f.route(f.addRoutes(provider, map[string]any{"upstream_id": "gpt-5-mini", "protocol": "responses"})[0])
	offered := f.do(http.MethodGet, "/admin/ai/catalog/models", &admin, nil)
	f.expect(offered, http.StatusOK, 0)
	want := fmt.Sprintf(`[{"canonical_id":"openai/gpt-5-mini","name":"GPT-5 mini","lab":"openai","vision":true,"moderation":false,"temperature":false,"tool_call":false,"reasoning":true,"context_limit":400000,"output_limit":128000,"input_price":0.25,"output_price":2,"model_id":%d,"offers":[{"provider":{"id":%d,"name":"OpenAI","kind":"openai"},"upstream_id":"gpt-5-mini","protocol":"responses","protocols":["responses"],"input_price":0.25,"output_price":2}]}]`, route.Model.ID, provider)
	if string(offered.Data) != want {
		t.Fatalf("offers %s", offered.Data)
	}
}
