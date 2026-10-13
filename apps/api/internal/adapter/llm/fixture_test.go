package llm_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/llm"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type recorded struct {
	Method string
	Path   string
	Query  string
	Header http.Header
	Body   map[string]any
}

type upstream struct {
	server   *httptest.Server
	mu       sync.Mutex
	requests []recorded
}

func newUpstream(t *testing.T, handle http.HandlerFunc) *upstream {
	t.Helper()
	u := &upstream{}
	u.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		entry := recorded{Method: r.Method, Path: r.URL.Path, Query: r.URL.RawQuery, Header: r.Header.Clone()}
		if len(raw) > 0 {
			if err := json.Unmarshal(raw, &entry.Body); err != nil {
				t.Errorf("request body is not JSON: %s", raw)
			}
		}
		u.mu.Lock()
		u.requests = append(u.requests, entry)
		u.mu.Unlock()
		handle(w, r)
	}))
	t.Cleanup(u.server.Close)
	return u
}

func (u *upstream) last(t *testing.T) recorded {
	t.Helper()
	u.mu.Lock()
	defer u.mu.Unlock()
	if len(u.requests) == 0 {
		t.Fatal("no request reached the upstream")
	}
	return u.requests[len(u.requests)-1]
}

func streamEvents(events ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		for _, event := range events {
			_, _ = io.WriteString(w, event)
			if !strings.HasSuffix(event, "\n\n") {
				_, _ = io.WriteString(w, "\n\n")
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
}

func data(payload string) string {
	return "data: " + payload
}

func named(name, payload string) string {
	return fmt.Sprintf("event: %s\ndata: %s", name, payload)
}

func respondJSON(status int, body string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}
}

func newClient() *llm.Client {
	return llm.NewClient(&http.Client{Timeout: 5 * time.Second})
}

func target(kind ai.ProviderKind, protocol ai.Protocol, base string) ai.RouteTarget {
	return ai.RouteTarget{
		ID:         1,
		Connection: ai.Connection{Kind: kind, BaseURL: &base, APIKey: "sk-test"},
		UpstreamID: "model-x",
		Protocol:   protocol,
	}
}

func generation(route ai.RouteTarget) ai.Generation {
	return ai.Generation{
		Route:  route,
		Prompt: ai.Prompt{System: "be brief", Messages: []ai.Message{{Role: ai.RoleUser, Content: "hi"}, {Role: ai.RoleAssistant, Content: "hello"}, {Role: ai.RoleUser, Content: "again"}}},
	}
}

func ptr[T any](value T) *T {
	return &value
}

func failureOf(t *testing.T, err error) *ai.Failure {
	t.Helper()
	var failure *ai.Failure
	if !errors.As(err, &failure) {
		t.Fatalf("expected *ai.Failure, got %T %v", err, err)
	}
	return failure
}

func field(body map[string]any, path ...string) any {
	var current any = body
	for _, key := range path {
		object, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = object[key]
	}
	return current
}

const objectSchema = `{"type":"object","properties":{"ok":{"type":"boolean"}},"required":["ok"]}`
