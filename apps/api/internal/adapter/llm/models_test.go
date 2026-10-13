package llm_test

import (
	"net/http"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func connection(kind ai.ProviderKind, base string) ai.Connection {
	return ai.Connection{Kind: kind, BaseURL: &base, APIKey: "sk-test"}
}

func TestListModelsReadsRelayEndpointTypes(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusOK, `{"data":[
		{"id":"gpt-5","owned_by":"openai","supported_endpoint_types":["openai","openai-response","unknown"]},
		{"id":"claude","display_name":"Claude","supported_endpoint_types":["anthropic"]},
		{"id":"typesafe","supported_endpoint_types":["systemone"]},
		{"id":"plain"},
		{"name":"models/named","displayName":"Named"},
		{"object":"model"}
	]}`))
	models, err := newClient().ListModels(t.Context(), connection(ai.KindCompatible, u.server.URL+"/v1/"))
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 4 {
		t.Fatalf("models %+v", models)
	}
	if models[0].ID != "gpt-5" || !slices.Equal(models[0].Protocols, []ai.Protocol{ai.ProtocolChat, ai.ProtocolResponses}) || *models[0].Owner != "openai" {
		t.Fatalf("relay model %+v", models[0])
	}
	if *models[1].Name != "Claude" || !slices.Equal(models[1].Protocols, []ai.Protocol{ai.ProtocolMessages}) {
		t.Fatalf("display name %+v", models[1])
	}
	if models[2].ID != "plain" || models[2].Protocols != nil || models[2].Name != nil {
		t.Fatalf("unknown protocols %+v", models[2])
	}
	if models[3].ID != "named" || *models[3].Name != "Named" {
		t.Fatalf("name id %+v", models[3])
	}
	sent := u.last(t)
	if sent.Method != http.MethodGet || sent.Path != "/v1/models" || sent.Header.Get("Authorization") != "Bearer sk-test" {
		t.Fatalf("request %s %s %v", sent.Method, sent.Path, sent.Header)
	}
}

func TestListModelsReadsNativeProtocolLists(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusOK, `[{"id":"m","protocols":[{"id":"openai-completions"},{"id":"anthropic-messages","native":true}]}]`))
	models, err := newClient().ListModels(t.Context(), connection(ai.KindCompatible, u.server.URL))
	if err != nil || len(models) != 1 || models[0].Native == nil || *models[0].Native != ai.ProtocolMessages ||
		!slices.Equal(models[0].Protocols, []ai.Protocol{ai.ProtocolChat, ai.ProtocolMessages}) {
		t.Fatalf("models %+v %v", models, err)
	}
}

func TestListModelsForGoogleAndAnthropic(t *testing.T) {
	google := newUpstream(t, respondJSON(http.StatusOK, `{"models":[
		{"name":"models/gemini-pro","displayName":"Gemini Pro","supportedGenerationMethods":["generateContent","countTokens"]},
		{"name":"models/embedding","supportedGenerationMethods":["embedContent"]}
	]}`))
	models, err := newClient().ListModels(t.Context(), connection(ai.KindGoogle, google.server.URL+"/v1beta"))
	if err != nil || len(models) != 1 || models[0].ID != "gemini-pro" || !slices.Equal(models[0].Protocols, []ai.Protocol{ai.ProtocolGemini}) {
		t.Fatalf("google %+v %v", models, err)
	}
	if sent := google.last(t); sent.Query != "pageSize=1000" || sent.Header.Get("x-goog-api-key") != "sk-test" || sent.Header.Get("Authorization") != "" {
		t.Fatalf("google request %s %v", sent.Query, sent.Header)
	}
	anthropic := newUpstream(t, respondJSON(http.StatusOK, `{"data":[{"id":"claude-x","display_name":"Claude X"}]}`))
	if _, err := newClient().ListModels(t.Context(), connection(ai.KindAnthropic, anthropic.server.URL)); err != nil {
		t.Fatal(err)
	}
	if sent := anthropic.last(t); sent.Query != "limit=1000" || sent.Header.Get("x-api-key") != "sk-test" || sent.Header.Get("anthropic-version") == "" || sent.Header.Get("Authorization") != "Bearer sk-test" {
		t.Fatalf("anthropic request %s %v", sent.Query, sent.Header)
	}
}

func TestListModelsFailuresAreClassified(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusForbidden, `{"error":{"message":"invalid api key"}}`))
	_, err := newClient().ListModels(t.Context(), connection(ai.KindCompatible, u.server.URL))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorAuth {
		t.Fatalf("failure %+v", failure)
	}
}
