package auth

import (
	"net/url"
	"regexp"
	"strings"
	"time"
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

var schemePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.\-]*:`)

var returnToBase = &url.URL{Scheme: "http", Host: "localhost", Path: "/"}

func SafeReturnTo(raw string) string {
	cleaned := strings.TrimFunc(raw, func(r rune) bool { return r <= 0x20 })
	cleaned = strings.Map(func(r rune) rune {
		if r == '\t' || r == '\n' || r == '\r' {
			return -1
		}
		return r
	}, cleaned)
	if cleaned == "" || schemePattern.MatchString(cleaned) {
		return "/"
	}
	cleaned = normalizeSlashes(cleaned)
	if strings.HasPrefix(cleaned, "//") {
		return "/"
	}
	ref, err := url.Parse(cleaned)
	if err != nil || ref.Host != "" || ref.Scheme != "" {
		return "/"
	}
	resolved := returnToBase.ResolveReference(ref)
	if resolved.Host != returnToBase.Host {
		return "/"
	}
	path := resolved.EscapedPath()
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return "/"
	}
	if resolved.RawQuery != "" {
		path += "?" + escapeQuery(resolved.RawQuery)
	}
	return path
}

func WithQuery(path, key, value string) string {
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	return path + separator + key + "=" + url.QueryEscape(value)
}

func normalizeSlashes(raw string) string {
	end := strings.IndexAny(raw, "?#")
	if end < 0 {
		end = len(raw)
	}
	return strings.ReplaceAll(raw[:end], `\`, "/") + raw[end:]
}

func escapeQuery(raw string) string {
	var builder strings.Builder
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if c <= 0x20 || c >= 0x7f || c == '"' || c == '#' || c == '<' || c == '>' || c == '\'' {
			builder.WriteString("%")
			builder.WriteString(strings.ToUpper(hexByte(c)))
			continue
		}
		builder.WriteByte(c)
	}
	return builder.String()
}

func hexByte(c byte) string {
	const digits = "0123456789abcdef"
	return string([]byte{digits[c>>4], digits[c&0x0f]})
}

const (
	oidcCallbackPath  = "/api/auth/oidc/callback"
	nameAttempts      = 50
	nameSuffixedRunes = 15
)
