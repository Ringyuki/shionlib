package oidcprovider

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

const maxTokenResponse = 1 << 20

type Options struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	Scopes       []string
}

type Client struct {
	settings Options
	http     *http.Client
	now      func() time.Time
	mu       sync.Mutex
	verifier *gooidc.IDTokenVerifier
}

func New(settings Options, client *http.Client, now func() time.Time) *Client {
	settings.Issuer = strings.TrimSuffix(settings.Issuer, "/")
	return &Client{settings: settings, http: client, now: now}
}

func (c *Client) AuthorizeURL(req auth.AuthorizeRequest) string {
	params := []struct{ key, value string }{
		{"client_id", c.settings.ClientID},
		{"redirect_uri", req.RedirectURI},
		{"response_type", "code"},
		{"scope", strings.Join(c.settings.Scopes, " ")},
		{"code_challenge", req.CodeChallenge},
		{"code_challenge_method", "S256"},
		{"state", req.State},
		{"nonce", req.Nonce},
	}
	encoded := make([]string, len(params))
	for i, param := range params {
		encoded[i] = url.QueryEscape(param.key) + "=" + url.QueryEscape(param.value)
	}
	return c.settings.Issuer + "/auth?" + strings.Join(encoded, "&")
}

type tokenResponse struct {
	IDToken string `json:"id_token"`
}

type idClaims struct {
	Email             string          `json:"email"`
	EmailVerified     json.RawMessage `json:"email_verified"`
	PreferredUsername string          `json:"preferred_username"`
	Nickname          string          `json:"nickname"`
	Name              string          `json:"name"`
}

func (c *Client) Exchange(ctx context.Context, req auth.CodeExchange) (auth.IdentityClaims, error) {
	raw, err := c.requestIDToken(ctx, req)
	if err != nil {
		return auth.IdentityClaims{}, err
	}
	verifier, err := c.idTokenVerifier(ctx)
	if err != nil {
		return auth.IdentityClaims{}, err
	}
	token, err := verifier.Verify(ctx, raw)
	if err != nil {
		return auth.IdentityClaims{}, fmt.Errorf("verify id token: %w", err)
	}
	if req.Nonce == "" || token.Nonce != req.Nonce {
		return auth.IdentityClaims{}, errors.New("id token nonce mismatch")
	}
	var claims idClaims
	if err := token.Claims(&claims); err != nil {
		return auth.IdentityClaims{}, fmt.Errorf("decode id token claims: %w", err)
	}
	return auth.IdentityClaims{
		Subject:           token.Subject,
		Email:             claims.Email,
		EmailVerified:     strings.TrimSpace(string(claims.EmailVerified)) == "true",
		PreferredUsername: claims.PreferredUsername,
		Nickname:          claims.Nickname,
		Name:              claims.Name,
	}, nil
}

func (c *Client) requestIDToken(ctx context.Context, req auth.CodeExchange) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", req.Code)
	form.Set("redirect_uri", req.RedirectURI)
	form.Set("code_verifier", req.Verifier)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.settings.Issuer+"/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("build token request: %w", err)
	}
	credentials := url.QueryEscape(c.settings.ClientID) + ":" + url.QueryEscape(c.settings.ClientSecret)
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credentials)))
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("exchange authorization code: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxTokenResponse))
	if err != nil {
		return "", fmt.Errorf("read token response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token endpoint responded %d", resp.StatusCode)
	}
	var decoded tokenResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if decoded.IDToken == "" {
		return "", errors.New("token response has no id_token")
	}
	return decoded.IDToken, nil
}

func (c *Client) idTokenVerifier(ctx context.Context) (*gooidc.IDTokenVerifier, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.verifier != nil {
		return c.verifier, nil
	}
	provider, err := gooidc.NewProvider(gooidc.ClientContext(ctx, c.http), c.settings.Issuer)
	if err != nil {
		return nil, fmt.Errorf("discover oidc provider: %w", err)
	}
	c.verifier = provider.VerifierContext(gooidc.ClientContext(context.WithoutCancel(ctx), c.http), &gooidc.Config{ClientID: c.settings.ClientID, Now: c.now})
	return c.verifier, nil
}
