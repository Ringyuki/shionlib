package gamehttp_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
)

var superAdmin = actor.Actor{UserID: 51, Role: actor.RoleSuperAdmin, ContentLimit: actor.ContentLimitNeverShow}

func newBangumiEnv(t *testing.T, authorizer *gametest.BangumiAuthorizer) *apitest.Server {
	t.Helper()
	server := apitest.New(t)
	service := game.NewBangumiLinkService(authorizer, gametest.NewBangumiStates(), "https://shionlib.test", func() string { return "state-1" })
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	gamehttp.NewBangumiHandler(service, server.Builder, "https://shionlib.test/", logger).Register(server.API)
	return server
}

func bangumiRedirect(t *testing.T, server *apitest.Server, path string) string {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	req.RemoteAddr = "127.0.0.1:4000"
	req.Header.Set("Authorization", "Bearer "+apitest.Token(superAdmin))
	rec := httptest.NewRecorder()
	server.API.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected a redirect for %s, got %d %s", path, rec.Code, rec.Body)
	}
	return rec.Header().Get("Location")
}

func TestBangumiAuthorizationStatusIsForAdministrators(t *testing.T) {
	expires := time.Date(2026, 10, 20, 8, 0, 0, 0, time.UTC)
	server := newBangumiEnv(t, &gametest.BangumiAuthorizer{Configured: true, Authorized: true, ExpiresAt: &expires})
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization", As: &strict}), http.StatusForbidden, 403)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"configured":true,"authorized":true,"expires_at":"2026-10-20T08:00:00.000Z","callback_url":"https://shionlib.test/api/admin/bangumi/authorization/callback"}`
	if string(resp.Data) != want {
		t.Fatalf("status\n got %s\nwant %s", resp.Data, want)
	}
}

func TestOnlyASuperAdministratorAuthorizesBangumi(t *testing.T) {
	authorizer := &gametest.BangumiAuthorizer{Configured: true}
	server := newBangumiEnv(t, authorizer)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization/start", As: &staff}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization/callback?state=state-1&code=c", As: &staff}), http.StatusForbidden, 403)

	started := bangumiRedirect(t, server, "/admin/bangumi/authorization/start?returnTo=%2Fzh%2Fadmin%2Fcatalog")
	if !strings.HasPrefix(started, "https://bgm.test/oauth/authorize?") || !strings.HasSuffix(started, "state=state-1") {
		t.Fatalf("start: %q", started)
	}
	finished := bangumiRedirect(t, server, "/admin/bangumi/authorization/callback?state=state-1&code=code-1")
	if finished != "https://shionlib.test/zh/admin/catalog?bangumi=authorized" {
		t.Fatalf("callback: %q", finished)
	}
	if len(authorizer.Exchanged) != 1 {
		t.Fatalf("exchanged %v", authorizer.Exchanged)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization/callback?state=state-1&code=code-1", As: &superAdmin}), http.StatusBadRequest, 400110)
}

func TestAFailedBangumiAuthorizationReturnsToThePageWithTheOutcome(t *testing.T) {
	authorizer := &gametest.BangumiAuthorizer{Configured: true, ExchangeErr: game.ErrBangumiRequestFailed}
	server := newBangumiEnv(t, authorizer)
	bangumiRedirect(t, server, "/admin/bangumi/authorization/start?returnTo=%2Fzh%2Fadmin%2Fcatalog%3Ftab%3Dx")
	finished := bangumiRedirect(t, server, "/admin/bangumi/authorization/callback?state=state-1&code=code-1")
	if finished != "https://shionlib.test/zh/admin/catalog?bangumi=failed&tab=x" {
		t.Fatalf("callback: %q", finished)
	}

	unset := newBangumiEnv(t, &gametest.BangumiAuthorizer{})
	unset.Expect(unset.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/bangumi/authorization/start", As: &superAdmin}), http.StatusConflict, 400109)
}
