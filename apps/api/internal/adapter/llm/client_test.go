package llm_test

import (
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func TestEndpointsFollowTheProtocol(t *testing.T) {
	client := newClient()
	empty := ""
	cases := []struct {
		route ai.RouteTarget
		want  string
	}{
		{target(ai.KindCompatible, ai.ProtocolChat, "https://relay.test/v1/"), "https://relay.test/v1/chat/completions"},
		{target(ai.KindCompatible, ai.ProtocolResponses, "https://relay.test/v1"), "https://relay.test/v1/responses"},
		{target(ai.KindCompatible, ai.ProtocolMessages, "https://relay.test/v1"), "https://relay.test/v1/messages"},
		{target(ai.KindCompatible, ai.ProtocolGemini, "https://relay.test/v1beta"), "https://relay.test/v1beta/models/model-x:streamGenerateContent"},
		{target(ai.KindCompatible, ai.ProtocolModeration, "https://relay.test/v1"), "https://relay.test/v1/moderations"},
		{ai.RouteTarget{Connection: ai.Connection{Kind: ai.KindOpenAI}, UpstreamID: "gpt", Protocol: ai.ProtocolResponses}, "https://api.openai.com/v1/responses"},
		{ai.RouteTarget{Connection: ai.Connection{Kind: ai.KindAnthropic, BaseURL: &empty}, UpstreamID: "claude", Protocol: ai.ProtocolMessages}, "https://api.anthropic.com/v1/messages"},
		{ai.RouteTarget{Connection: ai.Connection{Kind: ai.KindGoogle}, UpstreamID: "tunedModels/mine", Protocol: ai.ProtocolGemini}, "https://generativelanguage.googleapis.com/v1beta/tunedModels/mine:streamGenerateContent"},
	}
	for _, tc := range cases {
		if got := client.Endpoint(tc.route); got != tc.want {
			t.Fatalf("%s %s: got %s want %s", tc.route.Connection.Kind, tc.route.Protocol, got, tc.want)
		}
	}
}

func TestModerationRoutesCannotGenerate(t *testing.T) {
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindOpenAI, ai.ProtocolModeration, "https://relay.test")))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorProtocol {
		t.Fatalf("failure %+v", failure)
	}
}

func TestHTTPErrorsAreClassified(t *testing.T) {
	u := newUpstream(t, respondJSON(http.StatusUnauthorized, `{"error":{"message":"Incorrect API key provided"}}`))
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL+"/v1")))
	failure := failureOf(t, err)
	if failure.Kind != ai.ErrorAuth || failure.Message != "HTTP 401 · Incorrect API key provided" {
		t.Fatalf("failure %+v", failure)
	}
}

func TestUnexpectedContentIsAProtocolFailure(t *testing.T) {
	u := newUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = io.WriteString(w, "<html>login</html>")
	})
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolResponses, u.server.URL)))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorProtocol {
		t.Fatalf("failure %+v", failure)
	}
}

func TestStreamsMustFinish(t *testing.T) {
	u := newUpstream(t, streamEvents(data(`{"choices":[{"delta":{"content":"cut"}}]}`)))
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL)))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorNetwork {
		t.Fatalf("failure %+v", failure)
	}
}

func TestIdleStreamsTimeOut(t *testing.T) {
	release := make(chan struct{})
	u := newUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, data(`{"choices":[{"delta":{"content":"a"}}]}`)+"\n\n")
		w.(http.Flusher).Flush()
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	defer close(release)
	request := generation(target(ai.KindCompatible, ai.ProtocolChat, u.server.URL))
	request.IdleTimeout = 50 * time.Millisecond
	started := time.Now()
	_, err := newClient().Generate(t.Context(), request)
	if failure := failureOf(t, err); failure.Kind != ai.ErrorTimeout {
		t.Fatalf("failure %+v", failure)
	}
	if time.Since(started) > 3*time.Second {
		t.Fatal("the idle timeout did not cut the stream")
	}
}

func TestUnreachableUpstreamsAreNetworkFailures(t *testing.T) {
	_, err := newClient().Generate(t.Context(), generation(target(ai.KindCompatible, ai.ProtocolChat, "http://127.0.0.1:1")))
	if failure := failureOf(t, err); failure.Kind != ai.ErrorNetwork {
		t.Fatalf("failure %+v", failure)
	}
}
