package llm

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const chatURL = "https://relay.test/v1/chat/completions"

func TestHTTPFailureKinds(t *testing.T) {
	cases := []struct {
		status int
		url    string
		body   string
		kind   ai.ErrorKind
		param  string
	}{
		{401, chatURL, `{"error":{"message":"Incorrect API key provided"}}`, ai.ErrorAuth, ""},
		{402, chatURL, `{"error":{"message":"payment required"}}`, ai.ErrorQuota, ""},
		{403, chatURL, `{"error":{"message":"用户额度不足"}}`, ai.ErrorAuth, ""},
		{429, chatURL, `{"error":{"message":"insufficient_quota"}}`, ai.ErrorQuota, ""},
		{404, chatURL, "{\"error\":{\"message\":\"The model `gpt-9` does not exist\"}}", ai.ErrorNotFound, ""},
		{503, chatURL, `{"error":{"message":"无可用渠道"}}`, ai.ErrorNotFound, ""},
		{429, chatURL, "rate limited", ai.ErrorRateLimit, ""},
		{502, chatURL, "<html>bad gateway</html>", ai.ErrorUpstream, ""},
		{400, "https://relay.test/v1/messages", `{"error":{"message":"model must be one of claude-*"}}`, ai.ErrorProtocol, ""},
		{404, "https://relay.test/v1/responses", "Not Found", ai.ErrorProtocol, ""},
		{404, chatURL, "Not Found", ai.ErrorNotFound, ""},
		{404, "https://relay.test/v1beta/models/x:streamGenerateContent?alt=sse", "Not Found", ai.ErrorProtocol, ""},
		{400, chatURL, `{"error":{"message":"Unsupported parameter: 'max_tokens' is not supported with this model."}}`, ai.ErrorParam, ai.ParamMaxOutputTokens},
		{400, chatURL, `{"error":{"message":"temperature is not supported for this model"}}`, ai.ErrorParam, ai.ParamTemperature},
		{400, chatURL, `{"error":{"message":"Invalid parameter: response_format of type json_schema"}}`, ai.ErrorStructured, ""},
		{400, chatURL, `{"error":{"message":"prompt is too long"}}`, ai.ErrorOther, ""},
	}
	for _, tc := range cases {
		failure := describeHTTP(tc.status, tc.url, tc.body, "fallback")
		if failure.Kind != tc.kind || failure.Param != tc.param {
			t.Fatalf("%d %s %s: got %+v", tc.status, tc.url, tc.body, failure)
		}
	}
}

func TestHTTPFailureMessages(t *testing.T) {
	failure := describeHTTP(401, chatURL, `{"error":{"message":"Incorrect API key provided"}}`, "Unauthorized")
	if failure.Message != "HTTP 401 · Incorrect API key provided" || !strings.Contains(failure.Detail, chatURL) {
		t.Fatalf("failure %+v", failure)
	}
	if got := describeHTTP(400, chatURL, `{"error":"model is required"}`, "Bad Request").Message; got != "HTTP 400 · model is required" {
		t.Fatalf("string error %q", got)
	}
	if got := describeHTTP(502, chatURL, "<html>bad gateway</html>", "Bad Gateway").Message; got != "HTTP 502 · Bad Gateway" {
		t.Fatalf("html body %q", got)
	}
	long := describeHTTP(500, chatURL, strings.Repeat("x", 10000), "Internal Server Error")
	if len([]rune(long.Message)) > 301 || len([]rune(long.Detail)) > 4001 {
		t.Fatalf("not clipped: %d %d", len([]rune(long.Message)), len([]rune(long.Detail)))
	}
}

func TestTransportFailures(t *testing.T) {
	idle, cancel := context.WithCancelCause(context.Background())
	cancel(errIdle)
	if failure := transportFailure(idle, context.Canceled, chatURL); failure.Kind != ai.ErrorTimeout {
		t.Fatalf("idle %+v", failure)
	}
	if failure := transportFailure(context.Background(), context.DeadlineExceeded, chatURL); failure.Kind != ai.ErrorTimeout {
		t.Fatalf("deadline %+v", failure)
	}
	if failure := transportFailure(context.Background(), errors.New("dial tcp: connection refused"), chatURL); failure.Kind != ai.ErrorNetwork {
		t.Fatalf("network %+v", failure)
	}
}

func TestStreamErrorCodes(t *testing.T) {
	cases := map[string]ai.ErrorKind{
		"rate_limit_exceeded": ai.ErrorRateLimit,
		"insufficient_quota":  ai.ErrorQuota,
		"invalid_api_key":     ai.ErrorAuth,
		"model_not_found":     ai.ErrorNotFound,
		"overloaded_error":    ai.ErrorUpstream,
		"":                    ai.ErrorOther,
	}
	for code, want := range cases {
		if failure := streamFailure(chatURL, code, "message", "", 0); failure.Kind != want {
			t.Fatalf("%q: %+v", code, failure)
		}
	}
}
