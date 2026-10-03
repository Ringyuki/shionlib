package oidcprovider

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

var now = time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)

type provider struct {
	server  *httptest.Server
	issuer  string
	key     *rsa.PrivateKey
	signer  *rsa.PrivateKey
	claims  map[string]any
	status  int
	form    url.Values
	basic   string
	noToken bool
}

func newProvider(t *testing.T) *provider {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	p := &provider{key: key, signer: key, status: http.StatusOK}
	mux := http.NewServeMux()
	mux.HandleFunc("/oidc/.well-known/openid-configuration", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer":                                p.issuer,
			"authorization_endpoint":                p.issuer + "/auth",
			"token_endpoint":                        p.issuer + "/token",
			"jwks_uri":                              p.issuer + "/jwks",
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("/oidc/jwks", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &p.key.PublicKey, KeyID: "k1", Algorithm: "RS256", Use: "sig"}}})
	})
	mux.HandleFunc("/oidc/token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		p.form = r.PostForm
		p.basic = r.Header.Get("Authorization")
		if p.status != http.StatusOK {
			w.WriteHeader(p.status)
			return
		}
		if p.noToken {
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "x"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id_token": p.sign(t), "access_token": "x"})
	})
	p.server = httptest.NewServer(mux)
	t.Cleanup(p.server.Close)
	p.issuer = p.server.URL + "/oidc"
	p.claims = map[string]any{
		"iss":                p.issuer,
		"aud":                "shionlib",
		"sub":                "subject-1",
		"exp":                now.Add(time.Hour).Unix(),
		"iat":                now.Unix(),
		"nonce":              "nonce-1",
		"email":              "user@example.test",
		"email_verified":     true,
		"preferred_username": "ringyuki",
	}
	return p
}

func (p *provider) sign(t *testing.T) string {
	t.Helper()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: p.signer}, (&jose.SignerOptions{}).WithHeader("kid", "k1").WithType("JWT"))
	if err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(p.claims)
	signed, err := signer.Sign(payload)
	if err != nil {
		t.Fatal(err)
	}
	compact, err := signed.CompactSerialize()
	if err != nil {
		t.Fatal(err)
	}
	return compact
}

func (p *provider) client() *Client {
	return New(Options{Issuer: p.issuer, ClientID: "shionlib", ClientSecret: "s3cr&t", Scopes: []string{"openid", "profile", "email"}}, httpclient.New(httpclient.Options{Timeout: 5 * time.Second}), func() time.Time { return now })
}

var exchange = auth.CodeExchange{Code: "code-1", Verifier: "verifier-1", RedirectURI: "https://shionlib.com/api/auth/oidc/callback", Nonce: "nonce-1"}

func TestAuthorizeURLKeepsTheLegacyContract(t *testing.T) {
	p := newProvider(t)
	raw := p.client().AuthorizeURL(auth.AuthorizeRequest{RedirectURI: "https://shionlib.com/api/auth/oidc/callback", State: "state-1", CodeChallenge: "challenge-1", Nonce: "nonce-1"})
	if !strings.HasPrefix(raw, p.issuer+"/auth?client_id=shionlib&redirect_uri=https%3A%2F%2Fshionlib.com%2Fapi%2Fauth%2Foidc%2Fcallback&response_type=code&scope=openid+profile+email&code_challenge=challenge-1&code_challenge_method=S256&state=state-1&nonce=nonce-1") {
		t.Fatalf("unexpected authorize url %s", raw)
	}
}

func TestExchangeVerifiesTheIDToken(t *testing.T) {
	p := newProvider(t)
	claims, err := p.client().Exchange(context.Background(), exchange)
	if err != nil {
		t.Fatal(err)
	}
	if claims != (auth.IdentityClaims{Subject: "subject-1", Email: "user@example.test", EmailVerified: true, PreferredUsername: "ringyuki"}) {
		t.Fatalf("unexpected claims %+v", claims)
	}
	if p.form.Get("grant_type") != "authorization_code" || p.form.Get("code") != "code-1" || p.form.Get("code_verifier") != "verifier-1" || p.form.Get("redirect_uri") != exchange.RedirectURI {
		t.Fatalf("unexpected token form %v", p.form)
	}
	if p.basic != "Basic "+base64.StdEncoding.EncodeToString([]byte("shionlib:s3cr%26t")) {
		t.Fatalf("client_secret_basic must url-encode the credentials: %s", p.basic)
	}
}

func TestExchangeRejectsUntrustedTokens(t *testing.T) {
	other, _ := rsa.GenerateKey(rand.Reader, 2048)
	cases := map[string]func(p *provider){
		"wrong nonce":       func(p *provider) { p.claims["nonce"] = "other" },
		"missing nonce":     func(p *provider) { delete(p.claims, "nonce") },
		"wrong audience":    func(p *provider) { p.claims["aud"] = "someone-else" },
		"expired":           func(p *provider) { p.claims["exp"] = now.Add(-time.Minute).Unix() },
		"wrong issuer":      func(p *provider) { p.claims["iss"] = "https://evil.example/oidc" },
		"forged signature":  func(p *provider) { p.signer = other },
		"token error":       func(p *provider) { p.status = http.StatusBadRequest },
		"missing id token":  func(p *provider) { p.noToken = true },
		"string verified":   func(p *provider) { p.claims["email_verified"] = "true" },
		"unverified e-mail": func(p *provider) { p.claims["email_verified"] = false },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := newProvider(t)
			mutate(p)
			claims, err := p.client().Exchange(context.Background(), exchange)
			if strings.Contains(name, "verified") {
				if err != nil || claims.EmailVerified {
					t.Fatalf("email_verified must be a strict boolean true: %+v %v", claims, err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected the exchange to fail, got %+v", claims)
			}
		})
	}
}
