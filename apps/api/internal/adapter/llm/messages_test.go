package llm_test

import (
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestMessagesStreamsText(t *testing.T) {
	u := newUpstream(t, streamEvents(
		named("message_start", `{"type":"message_start","message":{"usage":{"input_tokens":10,"cache_read_input_tokens":30,"cache_creation_input_tokens":5,"output_tokens":1}}}`),
		named("content_block_start", `{"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}`),
		named("content_block_delta", `{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"…"}}`),
		named("content_block_start", `{"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}`),
		named("content_block_delta", `{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Bonjour"}}`),
		named("message_delta", `{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":9}}`),
		named("message_stop", `{"type":"message_stop"}`),
	))
	completion, err := newClient().Generate(t.Context(), generation(target(ai.KindAnthropic, ai.ProtocolMessages, u.server.URL+"/v1")))
	if err != nil {
		t.Fatal(err)
	}
	if completion.Text != "Bonjour" || completion.FinishReason != ai.FinishStop || completion.FirstToken <= 0 ||
		completion.Usage != (ai.Usage{InputTokens: 45, OutputTokens: 9, CacheReadTokens: 30, CacheWriteTokens: 5}) {
		t.Fatalf("completion %+v", completion)
	}
	sent := u.last(t)
	if sent.Path != "/v1/messages" || sent.Header.Get("x-api-key") != "sk-test" || sent.Header.Get("anthropic-version") != "2023-06-01" ||
		sent.Header.Get("Authorization") != "" || sent.Body["system"] != "be brief" || sent.Body["max_tokens"] != float64(4096) || sent.Body["tools"] != nil {
		t.Fatalf("request %s %v %v", sent.Path, sent.Header, sent.Body)
	}
}

func TestMessagesForcesAToolForStructuredOutput(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"type":"message_start","message":{"usage":{"input_tokens":4}}}`),
		data(`{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"check","input":{}}}`),
		data(`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"ok\":"}}`),
		data(`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"true}"}}`),
		data(`{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":6}}`),
		data(`{"type":"message_stop"}`),
	))
	route := target(ai.KindCompatible, ai.ProtocolMessages, u.server.URL)
	route.DroppedParams = []string{ai.ParamMaxOutputTokens}
	request := generation(route)
	request.Schema = json.RawMessage(objectSchema)
	request.SchemaName = "check"
	request.MaxOutputTokens = ptr(64)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	if completion.Text != `{"ok":true}` || completion.FinishReason != ai.FinishStop {
		t.Fatalf("completion %+v", completion)
	}
	sent := u.last(t)
	tools, _ := json.Marshal(sent.Body["tools"])
	if string(tools) != `[{"description":"Return the result","input_schema":{"properties":{"ok":{"type":"boolean"}},"required":["ok"],"type":"object"},"name":"check"}]` ||
		field(sent.Body, "tool_choice", "name") != "check" || sent.Body["max_tokens"] != float64(4096) || sent.Header.Get("Authorization") != "Bearer sk-test" {
		t.Fatalf("request %s %v", tools, sent.Body)
	}
}

func TestMessagesJSONModeUsesPlainText(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"{}"}}`),
		data(`{"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":1}}`),
		data(`{"type":"message_stop"}`),
	))
	route := target(ai.KindAnthropic, ai.ProtocolMessages, u.server.URL)
	route.JSONMode = true
	request := generation(route)
	request.Schema = json.RawMessage(objectSchema)
	request.MaxOutputTokens = ptr(128)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil || completion.Text != "{}" || completion.FinishReason != ai.FinishLength {
		t.Fatalf("completion %+v %v", completion, err)
	}
	sent := u.last(t)
	if sent.Body["tools"] != nil || sent.Body["max_tokens"] != float64(128) {
		t.Fatalf("body %v", sent.Body)
	}
}

func TestMessagesErrorEventsAreClassified(t *testing.T) {
	u := newUpstream(t, streamEvents(named("error", `{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`)))
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindAnthropic, ai.ProtocolMessages, u.server.URL)))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorUpstream {
		t.Fatalf("failure %+v", failure)
	}
}
