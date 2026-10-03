package llm_test

import (
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestGeminiStreamsTextWithoutThoughts(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"candidates":[{"content":{"parts":[{"text":"plan","thought":true}]}}]}`),
		data(`{"candidates":[{"content":{"parts":[{"text":"Ans"}]}}]}`),
		data(`{"candidates":[{"content":{"parts":[{"text":"wer"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":3,"cachedContentTokenCount":2,"thoughtsTokenCount":4}}`),
	))
	request := generation(target(ai.KindGoogle, ai.ProtocolGemini, u.server.URL+"/v1beta"))
	request.Temperature = ptr(0.5)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	if completion.Text != "Answer" || completion.FinishReason != ai.FinishStop || completion.FirstToken <= 0 ||
		completion.Usage != (ai.Usage{InputTokens: 11, OutputTokens: 7, CacheReadTokens: 2, ReasoningTokens: 4}) {
		t.Fatalf("completion %+v", completion)
	}
	sent := u.last(t)
	contents, _ := json.Marshal(sent.Body["contents"])
	if sent.Path != "/v1beta/models/model-x:streamGenerateContent" || sent.Query != "alt=sse" || sent.Header.Get("x-goog-api-key") != "sk-test" ||
		sent.Header.Get("Authorization") != "" || field(sent.Body, "systemInstruction", "parts") == nil ||
		string(contents) != `[{"parts":[{"text":"hi"}],"role":"user"},{"parts":[{"text":"hello"}],"role":"model"},{"parts":[{"text":"again"}],"role":"user"}]` ||
		field(sent.Body, "generationConfig", "temperature") != 0.5 {
		t.Fatalf("request %s?%s %v", sent.Path, sent.Query, sent.Body)
	}
}

func TestGeminiStructuredOutput(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"candidates":[{"content":{"parts":[{"text":"{\"ok\":true}"}]},"finishReason":"MAX_TOKENS"}]}`)))
	route := target(ai.KindCompatible, ai.ProtocolGemini, u.server.URL)
	route.UpstreamID = "models/gemini-x"
	request := generation(route)
	request.Schema = json.RawMessage(objectSchema)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil || completion.FinishReason != ai.FinishLength {
		t.Fatalf("completion %+v %v", completion, err)
	}
	sent := u.last(t)
	if sent.Path != "/models/gemini-x:streamGenerateContent" || sent.Header.Get("Authorization") != "Bearer sk-test" ||
		field(sent.Body, "generationConfig", "responseMimeType") != "application/json" || field(sent.Body, "generationConfig", "responseJsonSchema") == nil {
		t.Fatalf("request %s %v", sent.Path, sent.Body)
	}
	request.Route.JSONMode = true
	if _, err := newClient().Generate(t.Context(), request); err != nil {
		t.Fatal(err)
	}
	if sent = u.last(t); field(sent.Body, "generationConfig", "responseJsonSchema") != nil || field(sent.Body, "generationConfig", "responseMimeType") != "application/json" {
		t.Fatalf("json mode %v", sent.Body)
	}
}

func TestGeminiErrorChunksAreClassified(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}`)))
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindGoogle, ai.ProtocolGemini, u.server.URL)))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorRateLimit {
		t.Fatalf("failure %+v", failure)
	}
}
