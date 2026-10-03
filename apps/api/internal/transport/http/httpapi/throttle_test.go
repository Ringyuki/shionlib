package httpapi_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type countingLimiter struct {
	mu     sync.Mutex
	hits   map[string]int
	keys   []string
	broken bool
}

func (l *countingLimiter) Allow(_ context.Context, policy ratelimit.Policy, key string) (ratelimit.Decision, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.broken {
		return ratelimit.Decision{}, errors.New("redis down")
	}
	l.keys = append(l.keys, policy.Name+"|"+key)
	l.hits[policy.Name+key]++
	hits := l.hits[policy.Name+key]
	return ratelimit.Decision{
		Allowed:    hits <= policy.Limit,
		Limit:      policy.Limit,
		Remaining:  max(0, policy.Limit-hits),
		ResetAfter: 1500 * time.Millisecond,
		RetryAfter: 2 * time.Second,
	}, nil
}

func newThrottledAPI(t *testing.T, limiter httpapi.RateLimiter) *httpapi.API {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	builder := response.NewBuilder(catalog, time.Now)
	options := httpapi.Options{
		Title:          "test",
		Version:        "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  fakeAuthenticator{},
	}
	if limiter != nil {
		options.Throttling = &httpapi.Throttling{
			Limiter:  limiter,
			Policies: map[string]ratelimit.Policy{httpapi.DefaultThrottle: {Name: httpapi.DefaultThrottle, Limit: 1, Window: time.Minute}},
		}
	}
	api := httpapi.New(options)
	httpapi.Register(api, httpapi.Route{ID: "thing.ping", Method: http.MethodGet, Path: "/ping"},
		func(ctx context.Context, _ *struct{}) (*response.EmptyOutput, error) {
			return response.Empty(ctx, builder), nil
		})
	raw := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	policy := ratelimit.Policy{Name: "upload_chunk", Limit: 2, Window: time.Minute}
	api.Router().Put("/raw/{id}", api.Throttled(policy, "PUT /raw/{id}", raw).ServeHTTP)
	return api
}

func send(api *httpapi.API, method, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.RemoteAddr = "127.0.0.1:1234"
	req.Header.Set("X-Real-Ip", "203.0.113.9")
	rec := httptest.NewRecorder()
	api.Handler().ServeHTTP(rec, req)
	return rec
}

func TestThrottledRawRoutesShareTheHumaDecisionRules(t *testing.T) {
	limiter := &countingLimiter{hits: map[string]int{}}
	api := newThrottledAPI(t, limiter)
	for range 2 {
		if rec := send(api, http.MethodPut, "/raw/1"); rec.Code != http.StatusNoContent || rec.Header().Get("X-RateLimit-Limit") != "2" || rec.Header().Get("X-RateLimit-Reset") != "2" {
			t.Fatalf("allowed request: %d %v", rec.Code, rec.Header())
		}
	}
	denied := send(api, http.MethodPut, "/raw/2")
	if denied.Code != http.StatusTooManyRequests || denied.Header().Get("Retry-After") != "2" || denied.Header().Get("Retry-After-upload_chunk") != "2" || denied.Header().Get("X-RateLimit-Remaining") != "0" {
		t.Fatalf("denied request: %d %v", denied.Code, denied.Header())
	}
	if body := denied.Body.String(); !strings.Contains(body, `"code":429`) {
		t.Fatalf("denied body %s", body)
	}
	if rec := send(api, http.MethodGet, "/ping"); rec.Code != http.StatusOK || rec.Header().Get("X-RateLimit-Limit") != "1" {
		t.Fatalf("huma route: %d %v", rec.Code, rec.Header())
	}
	if rec := send(api, http.MethodGet, "/ping"); rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After-default") != "2" {
		t.Fatalf("huma route denied: %d %v", rec.Code, rec.Header())
	}
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if limiter.keys[0] != "upload_chunk|PUT /raw/{id}|203.0.113.9" || limiter.keys[3] != "default|GET /ping|203.0.113.9" {
		t.Fatalf("unexpected keys %v", limiter.keys)
	}
}

func TestThrottledFailsOpenAndIsANoOpWithoutThrottling(t *testing.T) {
	broken := &countingLimiter{hits: map[string]int{}, broken: true}
	api := newThrottledAPI(t, broken)
	for range 3 {
		if rec := send(api, http.MethodPut, "/raw/1"); rec.Code != http.StatusNoContent || rec.Header().Get("X-RateLimit-Limit") != "" {
			t.Fatalf("limiter errors must allow: %d %v", rec.Code, rec.Header())
		}
	}
	plain := newThrottledAPI(t, nil)
	for range 3 {
		if rec := send(plain, http.MethodPut, "/raw/1"); rec.Code != http.StatusNoContent {
			t.Fatalf("no throttling configured: %d", rec.Code)
		}
	}
}
