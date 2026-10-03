package auth

import (
	"strings"
	"time"
	"unicode/utf8"
)

const OIDCProvider = "hikarinagi"

type OIDCMode string

const (
	OIDCModeLogin OIDCMode = "login"
	OIDCModeLink  OIDCMode = "link"
)

func ParseOIDCMode(raw string) OIDCMode {
	if raw == string(OIDCModeLink) {
		return OIDCModeLink
	}
	return OIDCModeLogin
}

const (
	OIDCReasonState           = "state"
	OIDCReasonExchange        = "exchange"
	OIDCReasonEmailUnverified = "email_unverified"
	OIDCReasonBanned          = "banned"
	OIDCReasonLinkConflict    = "link_conflict"
	OIDCReasonLinkAuth        = "link_auth"
	OIDCReasonLinkRequired    = "link_required"
	OIDCReasonProvider        = "provider"
)

type OIDCError struct {
	Reason string
	Err    error
}

func (e *OIDCError) Error() string {
	if e.Err == nil {
		return "oidc: " + e.Reason
	}
	return "oidc: " + e.Reason + ": " + e.Err.Error()
}

func (e *OIDCError) Unwrap() error {
	return e.Err
}

func oidcFailure(reason string, cause error) *OIDCError {
	return &OIDCError{Reason: reason, Err: cause}
}

type OIDCTransaction struct {
	Verifier    string
	State       string
	ReturnTo    string
	Mode        OIDCMode
	RedirectURI string
	Nonce       string
}

type AuthorizeRequest struct {
	RedirectURI   string
	State         string
	CodeChallenge string
	Nonce         string
}

type CodeExchange struct {
	Code        string
	Verifier    string
	RedirectURI string
	Nonce       string
}

type IdentityClaims struct {
	Subject           string
	Email             string
	EmailVerified     bool
	PreferredUsername string
	Nickname          string
	Name              string
}

type Identity struct {
	ID          int
	UserID      int
	Provider    string
	Subject     string
	EmailAtLink *string
	LastLoginAt *time.Time
	Created     time.Time
}

type NewIdentity struct {
	UserID      int
	Provider    string
	Subject     string
	EmailAtLink *string
	LastLoginAt time.Time
}

type IdentityList struct {
	Items     []Identity
	CanUnlink bool
}

type CallbackInput struct {
	Code        string
	State       string
	ProviderErr string
	Transaction *OIDCTransaction
}

type CallbackResult struct {
	Mode   OIDCMode
	Tokens Tokens
}

func nameCandidate(claims IdentityClaims) string {
	raw := "user"
	for _, value := range []string{claims.PreferredUsername, claims.Nickname, claims.Name} {
		if value != "" {
			raw = value
			break
		}
	}
	raw = strings.TrimSpace(raw)
	if utf8.RuneCountInString(raw) < 2 {
		raw = "user_" + raw
	}
	return truncateRunes(raw, 16)
}

func truncateRunes(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n])
}
