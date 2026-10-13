package authhttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type storedTransactionDTO struct {
	Verifier    string `json:"v"`
	State       string `json:"s"`
	ReturnTo    string `json:"r"`
	Mode        string `json:"m"`
	RedirectURI string `json:"u"`
	Nonce       string `json:"n,omitempty"`
}

type sessionOutputDTO struct {
	AuthStale string   `header:"shionlib-auth-stale"`
	SetCookie []string `header:"Set-Cookie"`
	Body      response.Envelope[authSessionDTO]
}

type logoutOutputDTO struct {
	AuthStale string   `header:"shionlib-auth-stale"`
	SetCookie []string `header:"Set-Cookie"`
	Body      response.EmptyEnvelope
}

type oidcRedirectOutputDTO struct {
	Location  string   `header:"Location"`
	SetCookie []string `header:"Set-Cookie"`
}

type authSessionDTO struct {
	AccessTokenExp int64 `json:"accessTokenExp" doc:"Access token expiry as epoch milliseconds"`
}

type codeRequestedDTO struct {
	UUID string `json:"uuid"`
}

type codeVerifiedDTO struct {
	Verified bool `json:"verified"`
}

type passkeyFlowDTO struct {
	FlowID  string          `json:"flow_id"`
	Options json.RawMessage `json:"options"`
}

type passkeyCreatedDTO struct {
	ID                 int       `json:"id"`
	CredentialID       string    `json:"credential_id"`
	Name               *string   `json:"name"`
	DeviceType         *string   `json:"device_type"`
	CredentialBackedUp bool      `json:"credential_backed_up"`
	Created            time.Time `json:"created"`
}

type passkeyDTO struct {
	ID                 int        `json:"id"`
	CredentialID       string     `json:"credential_id"`
	Name               *string    `json:"name"`
	Transports         []string   `json:"transports"`
	AAGUID             *string    `json:"aaguid"`
	DeviceType         *string    `json:"device_type"`
	CredentialBackedUp bool       `json:"credential_backed_up"`
	LastUsedAt         *time.Time `json:"last_used_at"`
	Created            time.Time  `json:"created"`
}

type passkeyRevokedDTO struct {
	ID int `json:"id"`
}

type oidcIdentityDTO struct {
	ID          int       `json:"id"`
	Provider    string    `json:"provider"`
	EmailAtLink *string   `json:"email_at_link"`
	Created     time.Time `json:"created"`
}

type oidcIdentitiesDTO struct {
	Items     []oidcIdentityDTO `json:"items"`
	CanUnlink bool              `json:"can_unlink"`
}

func toPasskeyDTO(p auth.Passkey) passkeyDTO {
	transports := p.Transports
	if transports == nil {
		transports = []string{}
	}
	return passkeyDTO{
		ID:                 p.ID,
		CredentialID:       p.CredentialID,
		Name:               p.Name,
		Transports:         transports,
		AAGUID:             p.AAGUID,
		DeviceType:         p.DeviceType,
		CredentialBackedUp: p.BackedUp,
		LastUsedAt:         p.LastUsedAt,
		Created:            p.Created,
	}
}
