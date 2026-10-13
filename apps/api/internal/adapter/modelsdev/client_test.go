package modelsdev_test

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/modelsdev"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const fixture = `{
  "openai": {
    "id": "openai",
    "name": "OpenAI",
    "npm": "@ai-sdk/openai",
    "doc": "https://platform.openai.com/docs/models",
    "models": {
      "gpt-5": {
        "id": "gpt-5",
        "name": "GPT-5",
        "family": "gpt",
        "canonical_model_id": "openai/gpt-5",
        "modalities": {"input": ["text", "image"], "output": ["text"]},
        "limit": {"context": 400000.4, "output": 128000},
        "tool_call": true,
        "reasoning": true,
        "structured_output": true,
        "cost": {
          "input": 1.25,
          "output": 10,
          "cache_read": 0.125,
          "tiers": [
            {"tier": {"type": "context", "size": 272000}, "input": 2.5, "output": 15},
            {"tier": {"type": "context", "size": 128000}, "input": 2, "output": 12, "cache_read": 0.2},
            {"tier": {"type": "time", "size": 5}, "input": 9, "output": 9},
            {"tier": {"type": "context", "size": -1}, "input": 1, "output": 1}
          ]
        },
        "release_date": "2025-08-07"
      },
      "o-mini": {
        "temperature": false,
        "cost": {"input": -1, "output": "x"},
        "provider": {"npm": "@ai-sdk/openai-compatible"}
      }
    }
  },
  "relay": {
    "name": "Relay",
    "api": "https://relay.test/v1",
    "models": {}
  },
  "broken": "not an object"
}`

func serve(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(server.Close)
	return server
}

func fetch(t *testing.T, server *httptest.Server) (ai.Catalog, error) {
	t.Helper()
	return modelsdev.NewClient(&http.Client{Timeout: 5 * time.Second}, server.URL+"/api.json").Fetch(t.Context())
}

func TestFetchParsesProvidersAndModels(t *testing.T) {
	catalog, err := fetch(t, serve(t, http.StatusOK, fixture))
	if err != nil {
		t.Fatal(err)
	}
	if len(catalog.Providers) != 2 {
		t.Fatalf("providers %+v", catalog.Providers)
	}
	openai, relay := catalog.Providers[0], catalog.Providers[1]
	if openai.ID != "openai" || openai.Name != "OpenAI" || *openai.NPM != "@ai-sdk/openai" || openai.APIURL != nil || *openai.DocURL == "" {
		t.Fatalf("openai %+v", openai)
	}
	if relay.ID != "relay" || relay.Name != "Relay" || *relay.APIURL != "https://relay.test/v1" || relay.NPM != nil {
		t.Fatalf("relay %+v", relay)
	}
	if len(catalog.Models) != 2 {
		t.Fatalf("models %+v", catalog.Models)
	}
	gpt := catalog.Models[0]
	if gpt.ProviderID != "openai" || gpt.ModelKey != "gpt-5" || *gpt.CanonicalID != "openai/gpt-5" || gpt.Name != "GPT-5" || *gpt.Family != "gpt" ||
		!slices.Equal(gpt.InputModalities, []string{"text", "image"}) || !slices.Equal(gpt.OutputModalities, []string{"text"}) ||
		*gpt.ContextLimit != 400000 || *gpt.OutputLimit != 128000 || !gpt.Temperature || !gpt.ToolCall || !gpt.Reasoning || !*gpt.StructuredOutput ||
		*gpt.InputPrice != 1.25 || *gpt.OutputPrice != 10 || *gpt.CacheReadPrice != 0.125 || gpt.CacheWritePrice != nil || *gpt.ReleaseDate != "2025-08-07" {
		t.Fatalf("gpt %+v", gpt)
	}
	if len(gpt.PriceTiers) != 2 || gpt.PriceTiers[0].Over != 128000 || *gpt.PriceTiers[0].CacheRead != 0.2 || gpt.PriceTiers[1].Over != 272000 || gpt.PriceTiers[1].CacheRead != nil {
		t.Fatalf("tiers %+v", gpt.PriceTiers)
	}
	mini := catalog.Models[1]
	if mini.ModelKey != "o-mini" || mini.Name != "o-mini" || mini.Temperature || mini.InputPrice != nil || mini.OutputPrice != nil ||
		*mini.NPM != "@ai-sdk/openai-compatible" || mini.StructuredOutput != nil || len(mini.InputModalities) != 0 {
		t.Fatalf("mini %+v", mini)
	}
}

func TestFetchFailuresAreCatalogUnavailable(t *testing.T) {
	for _, server := range []*httptest.Server{
		serve(t, http.StatusBadGateway, "{}"),
		serve(t, http.StatusOK, "not json"),
		serve(t, http.StatusOK, "[1,2]"),
		serve(t, http.StatusOK, "null"),
	} {
		if _, err := fetch(t, server); !errors.Is(err, ai.ErrCatalogUnavailable) {
			t.Fatalf("%s: %v", server.URL, err)
		}
	}
}
