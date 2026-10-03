package httpapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var errThingMissing = apperror.Define(990101, "TEST_THING_MISSING", apperror.KindNotFound)

type fakeAuthenticator struct{}

func (fakeAuthenticator) Authenticate(_ context.Context, token string) (actor.Actor, error) {
	switch token {
	case "user":
		return actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow, FamilyID: "f1"}, nil
	case "admin":
		return actor.Actor{UserID: 2, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitJustShow, FamilyID: "f2"}, nil
	case "super":
		return actor.Actor{UserID: 3, Role: actor.RoleSuperAdmin, FamilyID: "f3"}, nil
	case "blocked":
		return actor.Guest(), auth.ErrFamilyBlocked
	default:
		return actor.Guest(), auth.ErrUnauthorized.Wrap(errors.New("bad token"))
	}
}

type createThingInput struct {
	Body struct {
		Name  string `json:"name" minLength:"2" maxLength:"5"`
		Count int    `json:"count" minimum:"1"`
	}
}

type thing struct {
	Name   string `json:"name"`
	UserID int    `json:"user_id"`
}

type thingPath struct {
	ID int `path:"id"`
}

func newTestAPI(t *testing.T) http.Handler {
	t.Helper()
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	now := func() time.Time { return time.Date(2026, 10, 3, 1, 2, 3, 456789000, time.UTC) }
	builder := response.NewBuilder(catalog, now)
	api := httpapi.New(httpapi.Options{
		Title:          "test",
		Version:        "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  fakeAuthenticator{},
		CORS:           httpapi.CORS{Origins: []string{"*"}, Methods: []string{"GET", "POST"}},
	})
	httpapi.Register(api, httpapi.Route{ID: "thing.create", Method: http.MethodPost, Path: "/things", Access: httpapi.AccessUser},
		func(ctx context.Context, in *createThingInput) (*response.Output[thing], error) {
			return response.OK(ctx, builder, thing{Name: in.Body.Name, UserID: actor.From(ctx).UserID}), nil
		})
	httpapi.Register(api, httpapi.Route{ID: "thing.get", Method: http.MethodGet, Path: "/things/{id}"},
		func(ctx context.Context, in *thingPath) (*response.Output[thing], error) {
			if in.ID == 404 {
				return nil, errThingMissing
			}
			if in.ID == 500 {
				return nil, errors.New("database exploded")
			}
			if in.ID == 999 {
				panic("boom")
			}
			return response.OK(ctx, builder, thing{Name: "x", UserID: actor.From(ctx).UserID}), nil
		})
	httpapi.Register(api, httpapi.Route{ID: "thing.purge", Method: http.MethodDelete, Path: "/things/{id}", Access: httpapi.AccessAdmin},
		func(ctx context.Context, _ *thingPath) (*response.EmptyOutput, error) {
			return response.Empty(ctx, builder), nil
		})
	httpapi.Register(api, httpapi.Route{ID: "thing.nuke", Method: http.MethodPost, Path: "/things/nuke", Access: httpapi.AccessSuperAdmin, Status: http.StatusOK},
		func(ctx context.Context, _ *struct{}) (*response.EmptyOutput, error) {
			return response.Empty(ctx, builder), nil
		})
	return api.Handler()
}

type envelope struct {
	Code      int             `json:"code"`
	Message   string          `json:"message"`
	Data      json.RawMessage `json:"data"`
	RequestID string          `json:"requestId"`
	Timestamp string          `json:"timestamp"`
	Meta      json.RawMessage `json:"meta"`
}

func do(t *testing.T, handler http.Handler, method, path, body string, headers map[string]string) (*httptest.ResponseRecorder, envelope, map[string]json.RawMessage) {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.RemoteAddr = "127.0.0.1:1234"
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	var env envelope
	raw := map[string]json.RawMessage{}
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response is not an envelope: %s", rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	if env.RequestID == "" || env.RequestID != rec.Header().Get(requestid.Header) {
		t.Fatalf("request id mismatch: body %q header %q", env.RequestID, rec.Header().Get(requestid.Header))
	}
	if env.Timestamp != "2026-10-03T01:02:03.456Z" {
		t.Fatalf("unexpected timestamp %q", env.Timestamp)
	}
	return rec, env, raw
}

func TestSuccessEnvelopeAndCreatedStatus(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodPost, "/things", `{"name":"abc","count":2}`, map[string]string{"Authorization": "Bearer user"})
	if rec.Code != http.StatusCreated || env.Code != 0 {
		t.Fatalf("status %d code %d body %s", rec.Code, env.Code, rec.Body.String())
	}
	if string(env.Data) != `{"name":"abc","user_id":1}` {
		t.Fatalf("unexpected data %s", env.Data)
	}
}

func TestValidationErrorsAreLocalizedFieldErrors(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodPost, "/things", `{"name":"a","count":0,"extra":true}`, map[string]string{"Authorization": "Bearer user"})
	if rec.Code != http.StatusUnprocessableEntity || env.Code != 100101 {
		t.Fatalf("status %d code %d body %s", rec.Code, env.Code, rec.Body.String())
	}
	var data struct {
		Errors []apperror.FieldError `json:"errors"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		t.Fatal(err)
	}
	fields := map[string][]string{}
	for _, field := range data.Errors {
		fields[field.Field] = field.Messages
	}
	if got := fields["name"]; len(got) != 1 || got[0] != "name 必须大于 2 个字符" {
		t.Fatalf("unexpected name errors %v (all %v)", got, fields)
	}
	if got := fields["count"]; len(got) != 1 || got[0] != "count 必须大于 1" {
		t.Fatalf("unexpected count errors %v (all %v)", got, fields)
	}
	if got := fields["extra"]; len(got) != 1 || got[0] != "extra 不应该存在" {
		t.Fatalf("unexpected extra errors %v (all %v)", got, fields)
	}
}

func TestRequiredAuthentication(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodPost, "/things", `{"name":"abc","count":2}`, nil)
	if rec.Code != http.StatusUnauthorized || env.Code != 200101 {
		t.Fatalf("missing token: status %d code %d", rec.Code, env.Code)
	}
	rec, env, _ = do(t, handler, http.MethodPost, "/things", `{"name":"abc","count":2}`, map[string]string{"Authorization": "Bearer nonsense"})
	if rec.Code != http.StatusUnauthorized || env.Code != 200101 {
		t.Fatalf("invalid token: status %d code %d", rec.Code, env.Code)
	}
	rec, env, _ = do(t, handler, http.MethodPost, "/things", `{"name":"abc","count":2}`, map[string]string{"Cookie": "shionlib_access_token=blocked"})
	if rec.Code != http.StatusForbidden || env.Code != 200106 {
		t.Fatalf("blocked family: status %d code %d", rec.Code, env.Code)
	}
	rec, env, _ = do(t, handler, http.MethodPost, "/things", `{"name":"abc","count":2}`, map[string]string{"Authorization": "Bearer undefined", "Cookie": "shionlib_access_token=user"})
	if rec.Code != http.StatusCreated || env.Code != 0 {
		t.Fatalf("cookie fallback: status %d code %d", rec.Code, env.Code)
	}
}

func TestRoleRequirements(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodDelete, "/things/1", "", map[string]string{"Authorization": "Bearer user"})
	if rec.Code != http.StatusForbidden || env.Code != 403 {
		t.Fatalf("user on admin route: status %d code %d", rec.Code, env.Code)
	}
	rec, env, raw := do(t, handler, http.MethodDelete, "/things/1", "", map[string]string{"Authorization": "Bearer super"})
	if rec.Code != http.StatusOK || env.Code != 0 {
		t.Fatalf("super admin on admin route: status %d code %d", rec.Code, env.Code)
	}
	if _, present := raw["data"]; present {
		t.Fatalf("empty responses must omit data: %s", rec.Body.String())
	}
	rec, env, _ = do(t, handler, http.MethodPost, "/things/nuke", "", map[string]string{"Authorization": "Bearer admin"})
	if rec.Code != http.StatusForbidden || env.Code != 403 {
		t.Fatalf("admin on super route: status %d code %d", rec.Code, env.Code)
	}
	rec, _, _ = do(t, handler, http.MethodPost, "/things/nuke", "", map[string]string{"Authorization": "Bearer super"})
	if rec.Code != http.StatusOK {
		t.Fatalf("explicit status override ignored: %d", rec.Code)
	}
}

func TestOptionalAuthenticationStaleSignal(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodGet, "/things/1", "", map[string]string{"Authorization": "Bearer expired"})
	if rec.Code != http.StatusOK || rec.Header().Get("shionlib-auth-stale") != "1" {
		t.Fatalf("status %d stale header %q", rec.Code, rec.Header().Get("shionlib-auth-stale"))
	}
	if !strings.Contains(string(env.Meta), `"optionalTokenStale":true`) {
		t.Fatalf("missing stale meta: %s", env.Meta)
	}
	if string(env.Data) != `{"name":"x","user_id":0}` {
		t.Fatalf("stale token must be treated as guest: %s", env.Data)
	}
	rec, env, _ = do(t, handler, http.MethodGet, "/things/1", "", nil)
	if rec.Header().Get("shionlib-auth-stale") != "" || len(env.Meta) != 0 {
		t.Fatalf("guest without token must not be stale: %s", rec.Body.String())
	}
	rec, _, _ = do(t, handler, http.MethodGet, "/things/404", "", map[string]string{"Authorization": "Bearer expired"})
	if rec.Header().Get("shionlib-auth-stale") != "" {
		t.Fatal("error responses must not carry the stale header")
	}
}

func TestErrorMapping(t *testing.T) {
	handler := newTestAPI(t)
	rec, env, _ := do(t, handler, http.MethodGet, "/things/404", "", map[string]string{"Accept-Language": "en-US,en;q=0.9"})
	if rec.Code != http.StatusNotFound || env.Code != 990101 || string(env.Data) != "null" {
		t.Fatalf("business error: status %d code %d data %s", rec.Code, env.Code, env.Data)
	}
	rec, env, _ = do(t, handler, http.MethodGet, "/things/500", "", map[string]string{"Accept-Language": "en"})
	if rec.Code != http.StatusInternalServerError || env.Code != 500 || env.Message != "request failed" {
		t.Fatalf("internal error: status %d code %d message %q", rec.Code, env.Code, env.Message)
	}
	if strings.Contains(rec.Body.String(), "exploded") {
		t.Fatal("internal error details leaked to the client")
	}
	rec, env, _ = do(t, handler, http.MethodGet, "/things/999", "", nil)
	if rec.Code != http.StatusInternalServerError || env.Code != 500 {
		t.Fatalf("panic: status %d code %d", rec.Code, env.Code)
	}
	rec, env, _ = do(t, handler, http.MethodGet, "/things/abc", "", nil)
	if rec.Code != http.StatusUnprocessableEntity || env.Code != 100101 {
		t.Fatalf("bad path param: status %d code %d", rec.Code, env.Code)
	}
	rec, env, _ = do(t, handler, http.MethodGet, "/missing", "", map[string]string{"Cookie": "shionlib_locale=ja"})
	if rec.Code != http.StatusNotFound || env.Code != 404 || env.Message != "見つかりません" {
		t.Fatalf("unknown route: status %d code %d message %q", rec.Code, env.Code, env.Message)
	}
	rec, env, _ = do(t, handler, http.MethodPost, "/things", `{"name":`, map[string]string{"Authorization": "Bearer user"})
	if rec.Code >= 500 || env.Code == 0 {
		t.Fatalf("malformed body must be a client error: status %d code %d", rec.Code, env.Code)
	}
}

func TestUpstreamRequestIDIsOnlyTrustedFromProxies(t *testing.T) {
	handler := newTestAPI(t)
	req := httptest.NewRequest(http.MethodGet, "/things/1", nil)
	req.RemoteAddr = "127.0.0.1:1"
	req.Header.Set(requestid.Header, "trusted-request-id-1")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Header().Get(requestid.Header) != "trusted-request-id-1" {
		t.Fatalf("trusted proxy request id ignored: %q", rec.Header().Get(requestid.Header))
	}
	req = httptest.NewRequest(http.MethodGet, "/things/1", nil)
	req.RemoteAddr = "203.0.113.9:1"
	req.Header.Set(requestid.Header, "spoofed-request-id-1")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Header().Get(requestid.Header) == "spoofed-request-id-1" {
		t.Fatal("request id from an untrusted client was accepted")
	}
}

type hiddenPath struct {
	ID int `path:"id"`
}

type embeddedUnexported struct {
	hiddenPath
}

func TestRegisterRejectsUnboundPathParams(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("expected registration to panic for an unbound path param")
		}
	}()
	catalog, _ := i18n.Load(i18n.LocaleZH)
	builder := response.NewBuilder(catalog, time.Now)
	api := httpapi.New(httpapi.Options{
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver(nil),
		Authenticator:  fakeAuthenticator{},
	})
	httpapi.Register(api, httpapi.Route{ID: "broken", Method: http.MethodGet, Path: "/broken/{id}"},
		func(ctx context.Context, _ *embeddedUnexported) (*response.EmptyOutput, error) {
			return response.Empty(ctx, builder), nil
		})
}

func TestCORSPreflightAllowsUploadAndLocaleHeaders(t *testing.T) {
	handler := newTestAPI(t)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, "/things", nil)
	req.Header.Set("Origin", "https://shionlib.test")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("preflight status %d", recorder.Code)
	}
	headers := recorder.Header()
	if headers.Get("Access-Control-Allow-Origin") != "*" || headers.Get("Access-Control-Allow-Methods") != "GET,POST" {
		t.Fatalf("preflight headers %v", headers)
	}
	allowed := strings.Split(headers.Get("Access-Control-Allow-Headers"), ",")
	for _, name := range []string{"Content-Type", "Authorization", "Accept-Language", "chunk-sha256"} {
		if !slices.Contains(allowed, name) {
			t.Fatalf("%s is not allowed: %v", name, allowed)
		}
	}
	if headers.Get("Access-Control-Expose-Headers") != "shionlib-auth-stale" {
		t.Fatalf("expose headers %v", headers)
	}
}
