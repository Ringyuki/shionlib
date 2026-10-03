package authhttp_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/authhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/user/usertest"
)

type env struct {
	server   *apitest.Server
	users    *usertest.MemoryRepository
	repo     *authtest.MemoryRepository
	store    *authtest.MemoryStore
	families *authtest.Blocklist
	mailer   *authtest.Mailer
	ceremony *authtest.Ceremony
	idp      *authtest.IdentityProvider
	sessions *auth.SessionService
}

func setup(t *testing.T, secure bool) *env {
	t.Helper()
	now := func() time.Time { return apitest.Now }
	e := &env{
		server:   apitest.New(t),
		users:    usertest.NewMemoryRepository(now),
		repo:     authtest.NewMemoryRepository(now),
		store:    authtest.NewMemoryStore(now),
		families: authtest.NewBlocklist(),
		mailer:   &authtest.Mailer{},
		ceremony: &authtest.Ceremony{},
		idp:      &authtest.IdentityProvider{},
	}
	tx := &txtest.Immediate{}
	e.sessions = auth.NewSessionService(e.repo, e.users, authtest.Codec{}, authtest.Hasher{}, e.families, e.store, tx, now, auth.SessionPolicy{
		Version: "slrt1", Pepper: "pepper", AccessTTL: time.Hour, ShortWindow: 7 * 24 * time.Hour, LongWindow: 30 * 24 * time.Hour, RotationGrace: 100 * time.Second,
	})
	services := authhttp.Deps{
		Sessions: e.sessions,
		Login:    auth.NewLoginService(e.users, authtest.Hasher{}, e.sessions, now),
		Codes:    auth.NewCodeService(e.store, e.mailer, now),
		Reset:    auth.NewPasswordResetService(e.users, e.store, e.mailer, authtest.Hasher{}, e.sessions, tx, "https://shionlib.example"),
		Passkeys: auth.NewPasskeyService(e.users, e.repo, e.ceremony, e.store, e.sessions, tx, now, 5*time.Minute),
		OIDC:     auth.NewOIDCService(e.idp, e.repo, e.repo, e.users, e.sessions, tx, now, []string{"https://shionlib.example"}),
	}
	policy := authhttp.CookieOptions{Secure: secure, AccessMaxAge: time.Hour, RefreshMaxAge: 7 * 24 * time.Hour}
	authhttp.NewHandler(services, policy, e.server.Builder, slog.New(slog.NewTextHandler(io.Discard, nil))).Register(e.server.API)
	return e
}

func (e *env) seed(mutate ...func(*user.User)) user.User {
	hash := "hash:Secret123"
	u := user.User{Name: "alice", Email: "alice@example.test", PasswordHash: &hash}
	for _, fn := range mutate {
		fn(&u)
	}
	return e.users.Seed(u)
}

var (
	accessCookie  = regexp.MustCompile(`^shionlib_access_token=access:[^;]+; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600$`)
	refreshCookie = regexp.MustCompile(`^shionlib_refresh_token=slrt1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800$`)
)

func refreshFrom(t *testing.T, header http.Header) string {
	t.Helper()
	for _, cookie := range header.Values("Set-Cookie") {
		if value, ok := strings.CutPrefix(cookie, "shionlib_refresh_token="); ok {
			return strings.Split(value, ";")[0]
		}
	}
	t.Fatalf("no refresh cookie in %v", header.Values("Set-Cookie"))
	return ""
}

func TestLoginSetsLegacyCookies(t *testing.T) {
	e := setup(t, true)
	e.seed()
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/login", Body: map[string]any{"identifier": "ALICE", "password": "Secret123"}})
	e.server.Expect(resp, http.StatusCreated, 0)
	want := `{"accessTokenExp":` + itoa(apitest.Now.Add(time.Hour).UnixMilli()) + `}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body %s want %s", resp.Data, want)
	}
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 2 || !accessCookie.MatchString(cookies[0]) || !refreshCookie.MatchString(cookies[1]) {
		t.Fatalf("unexpected cookies %q", cookies)
	}
}

func TestLoginErrors(t *testing.T) {
	e := setup(t, true)
	e.seed()
	e.seed(func(u *user.User) { u.Name = "banned"; u.Email = "banned@example.test"; u.Status = user.StatusBanned })
	cases := []struct {
		body         map[string]any
		status, code int
	}{
		{map[string]any{"identifier": "nobody", "password": "x"}, http.StatusNotFound, 300101},
		{map[string]any{"identifier": "banned", "password": "x"}, http.StatusForbidden, 300105},
		{map[string]any{"identifier": "alice", "password": "wrong"}, http.StatusUnauthorized, 300106},
		{map[string]any{"identifier": "", "password": "x"}, http.StatusUnprocessableEntity, 100101},
		{map[string]any{"identifier": "alice"}, http.StatusUnprocessableEntity, 100101},
	}
	for _, tc := range cases {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/user/login", Body: tc.body}), tc.status, tc.code)
	}
}

func TestRefreshRotatesAndDetectsReuse(t *testing.T) {
	e := setup(t, false)
	alice := e.seed()
	issued, err := e.sessions.Issue(context.Background(), auth.PrincipalOf(alice), auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/token/refresh"}), http.StatusUnauthorized, 200103)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/token/refresh", Header: map[string]string{"Cookie": "shionlib_refresh_token=" + issued.RefreshToken}})
	e.server.Expect(resp, http.StatusCreated, 0)
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 2 || strings.Contains(cookies[0], "Secure") || !strings.HasSuffix(cookies[1], "; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800") {
		t.Fatalf("Secure must follow AUTH_COOKIE_SECURE: %q", cookies)
	}
	rotated := refreshFrom(t, resp.Header)
	e.store.DropRefreshReplays()
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/token/refresh", Header: map[string]string{"Cookie": "shionlib_refresh_token=" + issued.RefreshToken}}), http.StatusUnauthorized, 200105)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/token/refresh", Header: map[string]string{"Cookie": "shionlib_refresh_token=" + rotated}}), http.StatusForbidden, 200106)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/token/refresh", Header: map[string]string{"Cookie": "shionlib_refresh_token=bogus"}}), http.StatusUnauthorized, 200103)
}

func TestLogoutClearsCookies(t *testing.T) {
	e := setup(t, true)
	alice := e.seed()
	issued, _ := e.sessions.Issue(context.Background(), auth.PrincipalOf(alice), auth.Device{})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/logout", Header: map[string]string{"Cookie": "shionlib_refresh_token=garbage"}}), http.StatusUnauthorized, 200103)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/logout", Header: map[string]string{"Cookie": "shionlib_refresh_token=" + issued.RefreshToken}})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("logout must omit data: %s", resp.Body)
	}
	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) != 2 || cookies[0] != "shionlib_access_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" || cookies[1] != "shionlib_refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" {
		t.Fatalf("unexpected cleared cookies %q", cookies)
	}
	if _, blocked := e.families.TTL(issued.FamilyID); !blocked {
		t.Fatal("logout must block the family")
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/logout"}), http.StatusOK, 0)
}

func TestVerificationCodes(t *testing.T) {
	e := setup(t, true)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/request", Body: map[string]any{"email": "new@example.test"}})
	e.server.Expect(resp, http.StatusCreated, 0)
	var requested struct {
		UUID string `json:"uuid"`
	}
	resp.Decode(t, &requested)
	code := e.mailer.Last().Body
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/request", Body: map[string]any{"email": "new@example.test", "scene": "x"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/verify", Body: map[string]any{"uuid": requested.UUID, "email": "new@example.test", "code": "ZZZZZZ"}}), http.StatusUnauthorized, 200108)
	verified := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/verify", Body: map[string]any{"uuid": requested.UUID, "email": "new@example.test", "code": code}})
	e.server.Expect(verified, http.StatusCreated, 0)
	if string(verified.Data) != `{"verified":true}` {
		t.Fatalf("unexpected verify body %s", verified.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/verify", Body: map[string]any{"uuid": requested.UUID, "email": "new@example.test", "code": code}}), http.StatusUnauthorized, 200107)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/code/verify", Body: map[string]any{"uuid": "not-a-uuid", "email": "new@example.test", "code": code}}), http.StatusUnprocessableEntity, 100101)
}

func TestPasswordResetFlow(t *testing.T) {
	e := setup(t, true)
	e.seed()
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget", Body: map[string]any{"email": "nobody@example.test"}}), http.StatusNotFound, 300101)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget", Body: map[string]any{"email": "alice@example.test"}})
	e.server.Expect(resp, http.StatusCreated, 0)
	if resp.HasData {
		t.Fatalf("void response must omit data: %s", resp.Body)
	}
	link, _ := url.Parse(e.mailer.Last().Body)
	token := link.Query().Get("token")
	check := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget/check", Body: map[string]any{"token": token, "email": "alice@example.test"}})
	e.server.Expect(check, http.StatusCreated, 0)
	if string(check.Data) != "true" {
		t.Fatalf("check must return a bare boolean: %s", check.Data)
	}
	other := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget/check", Body: map[string]any{"token": "00000000-0000-4000-8000-000000000000", "email": "alice@example.test"}})
	if string(other.Data) != "false" {
		t.Fatalf("unknown token: %s", other.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget/reset", Body: map[string]any{"token": token, "email": "alice@example.test", "password": "NewSecret1"}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/password/forget/reset", Body: map[string]any{"token": token, "email": "alice@example.test", "password": "NewSecret1"}}), http.StatusForbidden, 200109)
}

func TestPasskeyRoutes(t *testing.T) {
	e := setup(t, true)
	alice := e.seed()
	who := actor.Actor{UserID: alice.ID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	e.ceremony.Registered = auth.RegisteredPasskey{CredentialID: "cred-1", PublicKey: "pk", DeviceType: "multiDevice", BackedUp: true, Transports: []string{"internal"}}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/register/options", Body: map[string]any{}}), http.StatusUnauthorized, 200101)
	options := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/register/options", As: &who})
	e.server.Expect(options, http.StatusCreated, 0)
	var flow struct {
		FlowID  string         `json:"flow_id"`
		Options map[string]any `json:"options"`
	}
	options.Decode(t, &flow)
	if flow.FlowID == "" || flow.Options["user"] != "alice@example.test" {
		t.Fatalf("unexpected options %s", options.Data)
	}
	created := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/register/verify", As: &who, Body: map[string]any{"flow_id": flow.FlowID, "response": map[string]any{"id": "cred-1"}, "name": "Laptop"}})
	e.server.Expect(created, http.StatusCreated, 0)
	if !regexp.MustCompile(`^\{"id":\d+,"credential_id":"cred-1","name":"Laptop","device_type":"multiDevice","credential_backed_up":true,"created":"[^"]+"\}$`).Match(created.Data) {
		t.Fatalf("unexpected created passkey %s", created.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/register/verify", As: &who, Body: map[string]any{"flow_id": flow.FlowID, "response": "x"}}), http.StatusUnprocessableEntity, 100101)

	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/auth/passkey", As: &who})
	e.server.Expect(list, http.StatusOK, 0)
	if !regexp.MustCompile(`^\[\{"id":\d+,"credential_id":"cred-1","name":"Laptop","transports":\["internal"\],"aaguid":null,"device_type":"multiDevice","credential_backed_up":true,"last_used_at":"[^"]+","created":"[^"]+"\}\]$`).Match(list.Data) {
		t.Fatalf("unexpected list %s", list.Data)
	}

	login := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/login/options", Body: map[string]any{"identifier": "alice"}})
	e.server.Expect(login, http.StatusCreated, 0)
	login.Decode(t, &flow)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/login/verify", Body: map[string]any{"flow_id": "unknown", "response": map[string]any{"id": "cred-1", "valid": true}}}), http.StatusForbidden, 200110)
	verified := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/login/verify", Body: map[string]any{"flow_id": flow.FlowID, "response": map[string]any{"id": "cred-1", "counter": 3, "valid": true}}})
	e.server.Expect(verified, http.StatusCreated, 0)
	if len(verified.Header.Values("Set-Cookie")) != 2 || !strings.Contains(string(verified.Data), "accessTokenExp") {
		t.Fatalf("passkey login must set cookies: %s %v", verified.Data, verified.Header.Values("Set-Cookie"))
	}
	discoverable := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/auth/passkey/login/options"})
	e.server.Expect(discoverable, http.StatusCreated, 0)

	keys, _ := e.repo.ActivePasskeys(context.Background(), alice.ID)
	revoked := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/auth/passkey/" + itoa(int64(keys[0].ID)), As: &who})
	e.server.Expect(revoked, http.StatusOK, 0)
	if string(revoked.Data) != `{"id":`+itoa(int64(keys[0].ID))+`}` {
		t.Fatalf("unexpected revoke body %s", revoked.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/auth/passkey/" + itoa(int64(keys[0].ID)), As: &who}), http.StatusNotFound, 300101)
}

func redirect(t *testing.T, e *env, path string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	req.RemoteAddr = "127.0.0.1:4000"
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	rec := httptest.NewRecorder()
	e.server.API.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("expected a redirect for %s, got %d %s", path, rec.Code, rec.Body)
	}
	return rec
}

func TestOIDCStartAndCallback(t *testing.T) {
	e := setup(t, true)
	start := redirect(t, e, "/auth/oidc/start?returnTo=%2Fzh&origin=https%3A%2F%2Fevil.example", nil)
	location, _ := url.Parse(start.Header().Get("Location"))
	if location.Host != "id.example" || location.Query().Get("redirect_uri") != "https://shionlib.example/api/auth/oidc/callback" {
		t.Fatalf("unexpected authorize redirect %s", start.Header().Get("Location"))
	}
	txCookie := start.Header().Get("Set-Cookie")
	if !regexp.MustCompile(`^shionlib_oidc_tx=[^;]+; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600$`).MatchString(txCookie) {
		t.Fatalf("unexpected tx cookie %s", txCookie)
	}
	tx := strings.Split(strings.TrimPrefix(txCookie, "shionlib_oidc_tx="), ";")[0]
	state := location.Query().Get("state")

	failed := redirect(t, e, "/auth/oidc/callback?code=c&state=wrong", map[string]string{"Cookie": "shionlib_oidc_tx=" + tx})
	if failed.Header().Get("Location") != "/zh?oidc_error=state" || failed.Header().Get("Set-Cookie") != "shionlib_oidc_tx=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0" {
		t.Fatalf("state mismatch: %s %s", failed.Header().Get("Location"), failed.Header().Get("Set-Cookie"))
	}
	if missing := redirect(t, e, "/auth/oidc/callback?code=c&state="+state, nil); missing.Header().Get("Location") != "/?oidc_error=state" {
		t.Fatalf("missing tx cookie: %s", missing.Header().Get("Location"))
	}
	e.idp.Claims = auth.IdentityClaims{Subject: "sub-1", Email: "new@example.test", EmailVerified: true, PreferredUsername: "newbie"}
	ok := redirect(t, e, "/auth/oidc/callback?code=c&state="+state, map[string]string{"Cookie": "shionlib_oidc_tx=" + tx})
	cookies := ok.Header().Values("Set-Cookie")
	if ok.Header().Get("Location") != "/zh?oidc_login=1" || len(cookies) != 3 || !strings.HasPrefix(cookies[0], "shionlib_oidc_tx=;") || !accessCookie.MatchString(cookies[1]) || !refreshCookie.MatchString(cookies[2]) {
		t.Fatalf("login callback: %s %q", ok.Header().Get("Location"), cookies)
	}
	if e.idp.Exchanges[0].Nonce == "" {
		t.Fatal("the nonce from the transaction must reach the provider")
	}

	link := redirect(t, e, "/auth/oidc/start?mode=link&returnTo=%2F%2Fevil.com", nil)
	linkTx := strings.Split(strings.TrimPrefix(link.Header().Get("Set-Cookie"), "shionlib_oidc_tx="), ";")[0]
	linkLocation, _ := url.Parse(link.Header().Get("Location"))
	linkState := linkLocation.Query().Get("state")
	if guest := redirect(t, e, "/auth/oidc/callback?code=c&state="+linkState, map[string]string{"Cookie": "shionlib_oidc_tx=" + linkTx}); guest.Header().Get("Location") != "/?oidc_error=link_auth" {
		t.Fatalf("link without a session: %s", guest.Header().Get("Location"))
	}
	alice := e.seed()
	token := apitest.Token(actor.Actor{UserID: alice.ID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow})
	e.idp.Claims = auth.IdentityClaims{Subject: "sub-2"}
	linked := redirect(t, e, "/auth/oidc/callback?code=c&state="+linkState, map[string]string{"Cookie": "shionlib_oidc_tx=" + linkTx, "Authorization": "Bearer " + token})
	if linked.Header().Get("Location") != "/?oidc_linked=1" || len(linked.Header().Values("Set-Cookie")) != 1 {
		t.Fatalf("link callback: %s %v", linked.Header().Get("Location"), linked.Header().Values("Set-Cookie"))
	}
}

func TestOIDCIdentities(t *testing.T) {
	e := setup(t, true)
	alice := e.seed(func(u *user.User) { u.PasswordHash = nil })
	who := actor.Actor{UserID: alice.ID, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	email := "alice@example.test"
	_ = e.repo.CreateIdentity(context.Background(), auth.NewIdentity{UserID: alice.ID, Provider: auth.OIDCProvider, Subject: "s", EmailAtLink: &email, LastLoginAt: apitest.Now})
	identity, _, _ := e.repo.FindIdentity(context.Background(), auth.OIDCProvider, "s")

	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/auth/oidc/identities", As: &who})
	e.server.Expect(list, http.StatusOK, 0)
	want := `{"items":[{"id":` + itoa(int64(identity.ID)) + `,"provider":"hikarinagi","email_at_link":"alice@example.test","created":"2026-10-03T01:02:03.000Z"}],"can_unlink":false}`
	if string(list.Data) != want {
		t.Fatalf("unexpected identities\n got %s\nwant %s", list.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/auth/oidc/identities/" + itoa(int64(identity.ID)), As: &who}), http.StatusBadRequest, 200202)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/auth/oidc/identities/999", As: &who}), http.StatusNotFound, 200201)
	e.repo.SeedPasskey(auth.Passkey{UserID: alice.ID, CredentialID: "k"})
	unlinked := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/auth/oidc/identities/" + itoa(int64(identity.ID)), As: &who})
	e.server.Expect(unlinked, http.StatusOK, 0)
	if unlinked.HasData {
		t.Fatalf("unlink must omit data: %s", unlinked.Body)
	}
}

func itoa(v int64) string {
	return strconv.FormatInt(v, 10)
}
