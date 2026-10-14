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

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type keyGate struct {
	mu   sync.Mutex
	uses []bool
	ips  []string
}

func (g *keyGate) AuthenticateKey(_ context.Context, secret, ip string) (httpapi.KeyHolder, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.ips = append(g.ips, ip)
	switch secret {
	case "shl_good":
		return httpapi.KeyHolder{KeyID: 1, UserID: 5}, nil
	case "shl_roomy":
		limit := 3
		return httpapi.KeyHolder{KeyID: 2, UserID: 6, Limit: &limit}, nil
	default:
		return httpapi.KeyHolder{}, auth.ErrUnauthorized.Wrap(errors.New("no such key"))
	}
}

func (g *keyGate) RecordKeyUse(_ context.Context, _ httpapi.KeyHolder, throttled bool) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.uses = append(g.uses, throttled)
	return nil
}

func newKeyAPI(t *testing.T, gate *keyGate, limiter *countingLimiter) *httpapi.API {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	builder := response.NewBuilder(catalog, time.Now)
	settings := settingtest.Set(settingtest.Source{}, httpapi.OpenThrottleLimit, 1)
	api := httpapi.New(httpapi.Options{
		Title:          "test",
		Version:        "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  fakeAuthenticator{},
		CORS:           httpapi.CORS{Origins: []string{"https://shionlib.com"}, Methods: []string{"GET"}},
		Keys:           gate,
		Throttling: &httpapi.Throttling{
			Limiter:  limiter,
			Settings: settings,
			Policies: map[string]httpapi.ThrottlePolicy{
				httpapi.DefaultThrottle: {Limit: httpapi.DefaultThrottleLimit, Window: httpapi.DefaultThrottleWindow, Block: httpapi.DefaultThrottleBlock},
				"open":                  {Limit: httpapi.OpenThrottleLimit, Window: httpapi.OpenThrottleWindow, Block: httpapi.OpenThrottleBlock},
			},
		},
	})
	httpapi.Register(api, httpapi.Route{ID: "open.thing", Method: http.MethodGet, Path: "/open/v1/thing", Tags: []string{"open"}, Access: httpapi.AccessKey, Throttle: "open"},
		func(ctx context.Context, _ *struct{}) (*response.Output[int], error) {
			return response.OK(ctx, builder, actor.From(ctx).UserID), nil
		})
	return api
}

func withKey(api *httpapi.API, key, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/open/v1/thing", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	req.Header.Set("X-Real-Ip", "203.0.113.9")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	api.Handler().ServeHTTP(rec, req)
	return rec
}

func TestKeyRoutesAnswerTheOwnerOfAKeyAndCountItsUse(t *testing.T) {
	gate, limiter := &keyGate{}, &countingLimiter{hits: map[string]int{}}
	api := newKeyAPI(t, gate, limiter)
	if rec := withKey(api, "", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no key: %d %s", rec.Code, rec.Body)
	}
	first := withKey(api, "shl_good", "https://elsewhere.example")
	if first.Code != http.StatusOK || !jsonHas(first.Body.String(), `"data":5`) {
		t.Fatalf("the key's owner is the caller: %d %s", first.Code, first.Body)
	}
	if first.Header().Get("Access-Control-Allow-Origin") != "*" || first.Header().Get("X-RateLimit-Limit") != "1" {
		t.Fatalf("any origin and the account's rate: %v", first.Header())
	}
	if second := withKey(api, "shl_good", ""); second.Code != http.StatusTooManyRequests || second.Header().Get("Retry-After") == "" {
		t.Fatalf("over the account's limit: %d", second.Code)
	}
	for range 3 {
		if rec := withKey(api, "shl_roomy", ""); rec.Code != http.StatusOK {
			t.Fatalf("an account with its own limit: %d", rec.Code)
		}
	}
	if len(gate.uses) != 5 || gate.uses[0] || !gate.uses[1] || gate.ips[0] != "203.0.113.9" {
		t.Fatalf("every use is counted, refused ones apart: %v %v", gate.uses, gate.ips)
	}
	if limiter.keys[0] != "open|account|5" {
		t.Fatalf("the limit is kept per account, not per address: %v", limiter.keys)
	}
}

func jsonHas(body, part string) bool {
	return strings.Contains(body, part)
}
