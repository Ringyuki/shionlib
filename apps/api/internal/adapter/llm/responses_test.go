package llm_test

import (
	"encoding/json"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestResponsesStreamsTextAndUsage(t *testing.T) {
	u := newUpstream(t, streamEvents(
		named("response.created", `{"type":"response.created","response":{"status":"in_progress"}}`),
		named("response.reasoning_summary_text.delta", `{"type":"response.reasoning_summary_text.delta","delta":"hmm"}`),
		named("response.output_text.delta", `{"type":"response.output_text.delta","delta":"Hi "}`),
		named("response.output_text.delta", `{"type":"response.output_text.delta","delta":"there"}`),
		named("response.completed", `{"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":20,"output_tokens":7,"input_tokens_details":{"cached_tokens":8},"output_tokens_details":{"reasoning_tokens":3}}}}`),
	))
	request := generation(target(ai.KindOpenAI, ai.ProtocolResponses, u.server.URL+"/v1"))
	request.MaxOutputTokens = ptr(500)
	completion, err := newClient().Generate(t.Context(), request)
	if err != nil {
		t.Fatal(err)
	}
	if completion.Text != "Hi there" || completion.FinishReason != ai.FinishStop || completion.FirstToken <= 0 ||
		completion.Usage != (ai.Usage{InputTokens: 20, OutputTokens: 7, CacheReadTokens: 8, ReasoningTokens: 3}) {
		t.Fatalf("completion %+v", completion)
	}
	sent := u.last(t)
	input, _ := json.Marshal(sent.Body["input"])
	if sent.Path != "/v1/responses" || sent.Body["instructions"] != "be brief" || sent.Body["store"] != false || sent.Body["stream"] != true ||
		sent.Body["max_output_tokens"] != float64(500) || string(input) != `[{"content":"hi","role":"user"},{"content":"hello","role":"assistant"},{"content":"again","role":"user"}]` {
		t.Fatalf("request %s %v", sent.Path, sent.Body)
	}
}

func TestResponsesStructuredOutputFormats(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"type":"response.output_text.delta","delta":"{\"ok\":false}"}`),
		data(`{"type":"response.completed","response":{"status":"completed"}}`),
	))
	request := generation(target(ai.KindOpenAI, ai.ProtocolResponses, u.server.URL))
	request.Schema = json.RawMessage(objectSchema)
	if _, err := newClient().Generate(t.Context(), request); err != nil {
		t.Fatal(err)
	}
	format, _ := json.Marshal(field(u.last(t).Body, "text", "format"))
	if string(format) != `{"name":"result","schema":{"properties":{"ok":{"type":"boolean"}},"required":["ok"],"type":"object"},"strict":false,"type":"json_schema"}` {
		t.Fatalf("format %s", format)
	}
	request.Route.JSONMode = true
	if _, err := newClient().Generate(t.Context(), request); err != nil {
		t.Fatal(err)
	}
	sent := u.last(t)
	format, _ = json.Marshal(field(sent.Body, "text", "format"))
	if string(format) != `{"type":"json_object"}` || sent.Body["instructions"] == "be brief" {
		t.Fatalf("json mode %s %v", format, sent.Body["instructions"])
	}
}

func TestResponsesReportsTruncation(t *testing.T) {
	u := newUpstream(t, streamEvents(
		data(`{"type":"response.output_text.delta","delta":"{\"ok\""}`),
		data(`{"type":"response.incomplete","response":{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}}`),
	))
	completion, err := newClient().Generate(t.Context(), generation(target(ai.KindOpenAI, ai.ProtocolResponses, u.server.URL)))
	if err != nil || completion.FinishReason != ai.FinishLength {
		t.Fatalf("completion %+v %v", completion, err)
	}
}

func TestResponsesFailuresAreClassified(t *testing.T) {
	cases := map[string]ai.ErrorKind{
		named("response.failed", `{"type":"response.failed","response":{"status":"failed","error":{"code":"server_error","message":"boom"}}}`): ai.ErrorUpstream,
		data(`{"type":"error","code":"insufficient_quota","message":"You exceeded your current quota"}`):                                       ai.ErrorQuota,
		data(`{"type":"error","error":{"code":"invalid_api_key","message":"bad key"}}`):                                                        ai.ErrorAuth,
	}
	for event, want := range cases {
		u := newUpstream(t, streamEvents(event))
		_, err := newClient().Generate(t.Context(), generation(target(ai.KindOpenAI, ai.ProtocolResponses, u.server.URL)))
		if failure := failureOf(t, err); failure.Kind != want {
			t.Fatalf("%s: failure %+v", event, failure)
		}
	}
}
