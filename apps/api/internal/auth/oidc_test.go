package auth_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func TestSafeReturnTo(t *testing.T) {
	cases := map[string]string{
		"":                       "/",
		"/zh":                    "/zh",
		"/zh/game/1?tab=info#x":  "/zh/game/1?tab=info",
		"//evil.com":             "/",
		`/\evil.com`:             "/",
		`\\evil.com`:             "/",
		"/\t/evil.com":           "/",
		"https://evil.com":       "/",
		"javascript:alert(1)":    "/",
		"http://localhost/x":     "/",
		"  /padded  ":            "/padded",
		"relative/path":          "/relative/path",
		"/a/../b":                "/b",
		"/search?q=a b<c>":       "/search?q=a%20b%3Cc%3E",
		"/путь":                  "/%D0%BF%D1%83%D1%82%D1%8C",
		"?only=query":            "/?only=query",
		"/ok?next=//evil.com":    "/ok?next=//evil.com",
		"/x?y=\\z":               "/x?y=\\z",
		"/%2F%2Fevil.com":        "/%2F%2Fevil.com",
		"///evil.com":            "/",
		"/\\/evil.com":           "/",
		"\x00/x":                 "/x",
		"/x\x01":                 "/x",
		"/x\x01y":                "/",
		"#fragment":              "/",
		"/zh?":                   "/zh",
		"/zh?oidc_login=1&a=%20": "/zh?oidc_login=1&a=%20",
	}
	for raw, want := range cases {
		if got := auth.SafeReturnTo(raw); got != want {
			t.Errorf("SafeReturnTo(%q) = %q, want %q", raw, got, want)
		}
	}
	if got := auth.WithQuery("/zh", "oidc_error", "link_conflict"); got != "/zh?oidc_error=link_conflict" {
		t.Fatalf("with query: %s", got)
	}
	if got := auth.WithQuery("/zh?a=1", "oidc_login", "1"); got != "/zh?a=1&oidc_login=1" {
		t.Fatalf("with existing query: %s", got)
	}
}

func TestOIDCStartBuildsPKCEAndNonce(t *testing.T) {
	f := newFixture(t)
	authorize, tx, err := f.oidc.Start("//evil.com", "link", "https://shionlib.org")
	if err != nil {
		t.Fatal(err)
	}
	if tx.Mode != auth.OIDCModeLink || tx.ReturnTo != "/" || tx.RedirectURI != "https://shionlib.org/api/auth/oidc/callback" || tx.Nonce == "" || tx.State == "" || tx.Verifier == "" {
		t.Fatalf("unexpected transaction %+v", tx)
	}
	parsed, _ := url.Parse(authorize)
	digest := sha256.Sum256([]byte(tx.Verifier))
	if parsed.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(digest[:]) || parsed.Query().Get("nonce") != tx.Nonce || parsed.Query().Get("state") != tx.State {
		t.Fatalf("authorize url does not carry the transaction: %s", authorize)
	}
	_, fallback, _ := f.oidc.Start("/zh", "other", "https://evil.example")
	if fallback.Mode != auth.OIDCModeLogin || fallback.RedirectURI != "https://shionlib.example/api/auth/oidc/callback" || fallback.ReturnTo != "/zh" {
		t.Fatalf("unknown origins fall back to the first allowed origin: %+v", fallback)
	}
}

func callback(f *fixture, who actor.Actor, mode auth.OIDCMode) (auth.CallbackResult, error) {
	tx := auth.OIDCTransaction{Verifier: "verifier", State: "state", ReturnTo: "/", Mode: mode, RedirectURI: "https://shionlib.example/api/auth/oidc/callback", Nonce: "nonce"}
	return f.oidc.Callback(context.Background(), who, auth.CallbackInput{Code: "code", State: "state", Transaction: &tx}, auth.Device{})
}

func reason(err error) string {
	var flow *auth.OIDCError
	if errors.As(err, &flow) {
		return flow.Reason
	}
	return ""
}

func TestOIDCCallbackRejectsBadState(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	tx := auth.OIDCTransaction{Verifier: "v", State: "s", Mode: auth.OIDCModeLogin, Nonce: "n"}
	cases := []auth.CallbackInput{
		{Code: "c", State: "s", ProviderErr: "access_denied", Transaction: &tx},
		{Code: "c", State: "other", Transaction: &tx},
		{State: "s", Transaction: &tx},
		{Code: "c", State: "s"},
		{Code: "c", State: "s", Transaction: &auth.OIDCTransaction{Verifier: "v", State: "s"}},
	}
	for i, in := range cases {
		if _, err := f.oidc.Callback(ctx, actor.Guest(), in, auth.Device{}); reason(err) != auth.OIDCReasonState {
			t.Fatalf("case %d: %v", i, err)
		}
	}
	if len(f.idp.Exchanges) != 0 {
		t.Fatal("no code may be exchanged when the state check fails")
	}
}

func TestOIDCLoginProvisionsAndReusesAccounts(t *testing.T) {
	f := newFixture(t)
	f.idp.Claims = auth.IdentityClaims{Subject: "sub-1", Email: "new@example.test", EmailVerified: true, PreferredUsername: "ringyuki"}
	result, err := callback(f, actor.Guest(), auth.OIDCModeLogin)
	if err != nil {
		t.Fatal(err)
	}
	if result.Mode != auth.OIDCModeLogin || result.Tokens.SessionID == 0 {
		t.Fatalf("login must issue a session: %+v", result)
	}
	exchange := f.idp.Exchanges[0]
	if exchange.Nonce != "nonce" || exchange.Verifier != "verifier" || exchange.Code != "code" {
		t.Fatalf("exchange must carry the verifier and nonce: %+v", exchange)
	}
	created, found, _ := f.users.FindByEmail(context.Background(), "new@example.test")
	if !found || created.Name != "ringyuki" || created.EmailVerifiedAt == nil || created.HasPassword() || created.ContentLimit != actor.ContentLimitNeverShow {
		t.Fatalf("unexpected provisioned user %+v", created)
	}
	if !f.users.HasDefaultFavorite(created.ID) || !f.users.HasQuota(created.ID) {
		t.Fatal("provisioning must create the default favorite and quota")
	}
	again, err := callback(f, actor.Guest(), auth.OIDCModeLogin)
	if err != nil || again.Tokens.SessionID == result.Tokens.SessionID {
		t.Fatalf("linked identity logs in again: %+v %v", again, err)
	}
	if users := countUsers(f); users != 1 {
		t.Fatalf("no duplicate user may be created: %d", users)
	}
}

func countUsers(f *fixture) int {
	count := 0
	for id := 1; id < 100; id++ {
		if _, err := f.users.Get(context.Background(), id); err == nil {
			count++
		}
	}
	return count
}

func TestOIDCLoginAllocatesFreeNames(t *testing.T) {
	f := newFixture(t)
	f.seedUser(func(u *user.User) { u.Name = "ringyuki" })
	f.idp.Claims = auth.IdentityClaims{Subject: "sub-2", Email: "second@example.test", EmailVerified: true, PreferredUsername: "ringyuki"}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); err != nil {
		t.Fatal(err)
	}
	created, _, _ := f.users.FindByEmail(context.Background(), "second@example.test")
	if !strings.HasPrefix(created.Name, "ringyuki") || created.Name == "ringyuki" || len(created.Name) > 20 {
		t.Fatalf("taken names get a numeric suffix: %s", created.Name)
	}
	f.idp.Claims = auth.IdentityClaims{Subject: "sub-3", Email: "third@example.test", EmailVerified: true, Name: "x"}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); err != nil {
		t.Fatal(err)
	}
	if short, _, _ := f.users.FindByEmail(context.Background(), "third@example.test"); short.Name != "user_x" {
		t.Fatalf("short names are prefixed: %s", short.Name)
	}
}

func TestOIDCLoginAutoLinkRules(t *testing.T) {
	f := newFixture(t)
	member := f.seedUser(func(u *user.User) { u.Email = "Member@Example.test" })
	f.seedUser(func(u *user.User) { u.Email = "banned@example.test"; u.Status = user.StatusBanned })
	f.seedUser(func(u *user.User) { u.Email = "admin@example.test"; u.Role = actor.RoleAdmin })

	f.idp.Claims = auth.IdentityClaims{Subject: "unverified", Email: "member@example.test", EmailVerified: false}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); reason(err) != auth.OIDCReasonEmailUnverified {
		t.Fatalf("unverified email: %v", err)
	}
	f.idp.Claims = auth.IdentityClaims{Subject: "banned", Email: "banned@example.test", EmailVerified: true}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); reason(err) != auth.OIDCReasonBanned {
		t.Fatalf("banned account: %v", err)
	}
	if _, found, _ := f.repo.FindIdentity(context.Background(), auth.OIDCProvider, "banned"); found {
		t.Fatal("banned accounts must not be linked")
	}
	f.idp.Claims = auth.IdentityClaims{Subject: "admin", Email: "admin@example.test", EmailVerified: true}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); reason(err) != auth.OIDCReasonLinkRequired {
		t.Fatalf("staff accounts require an explicit link: %v", err)
	}
	f.idp.Claims = auth.IdentityClaims{Subject: "member", Email: "member@example.test", EmailVerified: true}
	result, err := callback(f, actor.Guest(), auth.OIDCModeLogin)
	if err != nil || result.Tokens.SessionID == 0 {
		t.Fatalf("verified email merges into the existing account: %+v %v", result, err)
	}
	identity, found, _ := f.repo.FindIdentity(context.Background(), auth.OIDCProvider, "member")
	if !found || identity.UserID != member.ID {
		t.Fatalf("identity not linked to the member: %+v", identity)
	}
	f.idp.Fail = errors.New("token endpoint down")
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLogin); reason(err) != auth.OIDCReasonExchange {
		t.Fatalf("exchange failure: %v", err)
	}
}

func TestOIDCLink(t *testing.T) {
	f := newFixture(t)
	alice := f.seedUser()
	bob := f.seedUser()
	f.idp.Claims = auth.IdentityClaims{Subject: "link-sub", Email: "unverified@example.test"}
	if _, err := callback(f, actor.Guest(), auth.OIDCModeLink); reason(err) != auth.OIDCReasonLinkAuth {
		t.Fatalf("link needs a session: %v", err)
	}
	if _, err := callback(f, actorOf(alice), auth.OIDCModeLink); err != nil {
		t.Fatalf("linking does not need a verified email: %v", err)
	}
	if _, err := callback(f, actorOf(alice), auth.OIDCModeLink); err != nil {
		t.Fatalf("linking twice is idempotent: %v", err)
	}
	if _, err := callback(f, actorOf(bob), auth.OIDCModeLink); reason(err) != auth.OIDCReasonLinkConflict {
		t.Fatalf("subject linked to another user: %v", err)
	}
}

func TestOIDCIdentitiesAndUnlink(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	oidcOnly := f.seedUser(func(u *user.User) { u.PasswordHash = nil })
	stranger := f.seedUser()
	_ = f.repo.CreateIdentity(ctx, auth.NewIdentity{UserID: oidcOnly.ID, Provider: auth.OIDCProvider, Subject: "a", LastLoginAt: f.clock.Now()})
	only, _, _ := f.repo.FindIdentity(ctx, auth.OIDCProvider, "a")

	list, err := f.oidc.Identities(ctx, actorOf(oidcOnly))
	if err != nil || len(list.Items) != 1 || list.CanUnlink {
		t.Fatalf("single identity without password: %+v %v", list, err)
	}
	if err := f.oidc.Unlink(ctx, actorOf(stranger), only.ID); !errors.Is(err, auth.ErrOIDCIdentityNotFound) {
		t.Fatalf("foreign identity: %v", err)
	}
	if err := f.oidc.Unlink(ctx, actorOf(oidcOnly), 999); !errors.Is(err, auth.ErrOIDCIdentityNotFound) {
		t.Fatalf("missing identity: %v", err)
	}
	if err := f.oidc.Unlink(ctx, actorOf(oidcOnly), only.ID); !errors.Is(err, auth.ErrOIDCLastLoginMethod) {
		t.Fatalf("last login method: %v", err)
	}
	f.repo.SeedPasskey(auth.Passkey{UserID: oidcOnly.ID, CredentialID: "key"})
	if list, _ := f.oidc.Identities(ctx, actorOf(oidcOnly)); !list.CanUnlink {
		t.Fatal("a passkey is another login method")
	}
	if err := f.oidc.Unlink(ctx, actorOf(oidcOnly), only.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ := f.oidc.Identities(ctx, actorOf(oidcOnly)); len(list.Items) != 0 {
		t.Fatalf("identity not removed: %+v", list)
	}
}
