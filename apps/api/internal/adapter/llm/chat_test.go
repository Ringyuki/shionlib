package llm_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestChatStreamsTextAndUsage(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"choices":[{"delta":{"reasoning_content":"thinking"}}]}`),
		data(`{"choices":[{"delta":{"content":"Hel"}}]}`),
		data(`{"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}`),
		data(`{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":5,"prompt_tokens_details":{"cached_tokens":4},"completion_tokens_details":{"reasoning_tokens":2}}}`),
		data(`[DONE]`),
	))
	request := generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL+"/v1/"))
	request.Temperature = ptr(0.2)
	request.MaxOutputTokens = ptr(300)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	if completion.Text != "Hello" || completion.FinishReason != ai.FinishStop || completion.FirstToken <= 0 {
		t.Fatalf("completion %+v", completion)
	}
	if completion.Usage != (ai.Usage{InputTokens: 12, OutputTokens: 5, CacheReadTokens: 4, ReasoningTokens: 2}) {
		t.Fatalf("usage %+v", completion.Usage)
	}
	sent := u.last(t)
	if sent.Path != "/v1/chat/completions" || sent.Header.Get("Authorization") != "Bearer sk-test" {
		t.Fatalf("request %s %v", sent.Path, sent.Header)
	}
	messages, _ := json.Marshal(sent.Body["messages"])
	if string(messages) != `[{"content":"be brief","role":"system"},{"content":"hi","role":"user"},{"content":"hello","role":"assistant"},{"content":"again","role":"user"}]` {
		t.Fatalf("messages %s", messages)
	}
	if sent.Body["model"] != "model-x" || sent.Body["stream"] != true || field(sent.Body, "stream_options", "include_usage") != true ||
		sent.Body["temperature"] != 0.2 || sent.Body["max_tokens"] != float64(300) || sent.Body["response_format"] != nil {
		t.Fatalf("body %v", sent.Body)
	}
}

func TestChatRequestsStructuredOutput(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"choices":[{"delta":{"content":"{\"ok\":true}"},"finish_reason":"stop"}]}`), data(`[DONE]`)))
	request := generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL))
	request.Schema = json.RawMessage(objectSchema)
	request.SchemaName = "check"
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil || completion.Text != `{"ok":true}` {
		t.Fatalf("completion %+v %v", completion, err)
	}
	format := u.last(t).Body["response_format"]
	encoded, _ := json.Marshal(format)
	if string(encoded) != `{"json_schema":{"name":"check","schema":{"properties":{"ok":{"type":"boolean"}},"required":["ok"],"type":"object"},"strict":false},"type":"json_schema"}` {
		t.Fatalf("response_format %s", encoded)
	}
}

func TestChatJSONModeMovesTheSchemaIntoThePrompt(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}`)))
	route := target(ai.KindCompatible, ai.ProtocolChat, u.server.URL)
	route.JSONMode = true
	route.DroppedParams = []string{ai.ParamTemperature, ai.ParamMaxOutputTokens}
	request := generation(route)
	request.Schema = json.RawMessage(objectSchema)
	request.Temperature = ptr(1.0)
	request.MaxOutputTokens = ptr(10)
	if _, err := newClient().Generate(t.Context(), request); err != nil {
		t.Fatal(err)
	}
	sent := u.last(t)
	system, _ := field(sent.Body, "messages").([]any)[0].(map[string]any)["content"].(string)
	if !strings.HasPrefix(system, "be brief\n\nReply with only a JSON object") || !strings.Contains(system, objectSchema) {
		t.Fatalf("system %q", system)
	}
	if field(sent.Body, "response_format", "type") != "json_object" || sent.Body["temperature"] != nil || sent.Body["max_tokens"] != nil {
		t.Fatalf("body %v", sent.Body)
	}
}

func TestChatStreamErrorsAreClassified(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"error":{"message":"Rate limit reached","type":"rate_limit_exceeded"}}`)))
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL)))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorRateLimit {
		t.Fatalf("failure %+v", failure)
	}
}

func TestChatAcceptsANonStreamingAnswer(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusOK, `{"choices":[{"message":{"content":"plain"},"finish_reason":"length"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}`))
	completion, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL)))
	if err != nil || completion.Text != "plain" || completion.FinishReason != ai.FinishLength || completion.Usage.InputTokens != 3 {
		t.Fatalf("completion %+v %v", completion, err)
	}
}
