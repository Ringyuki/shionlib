package authhttp

import (
	"encoding/json"
	"net/url"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

const (
	RefreshCookie = "shionlib_refresh_token"
	OIDCTxCookie  = "shionlib_oidc_tx"
	oidcTxMaxAge  = 600
)

type CookiePolicy struct {
	Secure        bool
	AccessMaxAge  time.Duration
	RefreshMaxAge time.Duration
}

func (p CookiePolicy) cookie(name, value string, maxAge int) string {
	flags := "; HttpOnly; "
	if p.Secure {
		flags += "Secure; "
	}
	return name + "=" + value + flags + "SameSite=Lax; Path=/; Max-Age=" + strconv.Itoa(maxAge)
}

func (p CookiePolicy) session(tokens auth.Tokens) []string {
	return []string{
		p.cookie(middleware.AccessTokenCookie, tokens.AccessToken, int(p.AccessMaxAge.Seconds())),
		p.cookie(RefreshCookie, tokens.RefreshToken, int(p.RefreshMaxAge.Seconds())),
	}
}

func (p CookiePolicy) cleared() []string {
	return []string{
		p.cookie(middleware.AccessTokenCookie, "", 0),
		p.cookie(RefreshCookie, "", 0),
	}
}

func (p CookiePolicy) transaction(tx auth.OIDCTransaction) (string, error) {
	raw, err := json.Marshal(storedTransaction{
		Verifier:    tx.Verifier,
		State:       tx.State,
		ReturnTo:    tx.ReturnTo,
		Mode:        string(tx.Mode),
		RedirectURI: tx.RedirectURI,
		Nonce:       tx.Nonce,
	})
	if err != nil {
		return "", err
	}
	return p.cookie(OIDCTxCookie, url.QueryEscape(string(raw)), oidcTxMaxAge), nil
}

func (p CookiePolicy) clearedTransaction() string {
	return p.cookie(OIDCTxCookie, "", 0)
}

type storedTransaction struct {
	Verifier    string `json:"v"`
	State       string `json:"s"`
	ReturnTo    string `json:"r"`
	Mode        string `json:"m"`
	RedirectURI string `json:"u"`
	Nonce       string `json:"n,omitempty"`
}

func parseTransaction(raw string) *auth.OIDCTransaction {
	if raw == "" {
		return nil
	}
	decoded, err := url.QueryUnescape(raw)
	if err != nil {
		return nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(decoded), &fields); err != nil {
		return nil
	}
	text := func(key string) (string, bool) {
		var value string
		if err := json.Unmarshal(fields[key], &value); err != nil {
			return "", false
		}
		return value, true
	}
	verifier, okVerifier := text("v")
	state, okState := text("s")
	redirectURI, okRedirect := text("u")
	if !okVerifier || !okState || !okRedirect {
		return nil
	}
	returnTo, _ := text("r")
	mode, _ := text("m")
	nonce, _ := text("n")
	return &auth.OIDCTransaction{
		Verifier:    verifier,
		State:       state,
		ReturnTo:    auth.SafeReturnTo(returnTo),
		Mode:        auth.ParseOIDCMode(mode),
		RedirectURI: redirectURI,
		Nonce:       nonce,
	}
}
