package authhttp

import (
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type sessionOutput struct {
	AuthStale string   `header:"shionlib-auth-stale"`
	SetCookie []string `header:"Set-Cookie"`
	Body      response.Envelope[authSessionDTO]
}

type logoutOutput struct {
	AuthStale string   `header:"shionlib-auth-stale"`
	SetCookie []string `header:"Set-Cookie"`
	Body      response.EmptyEnvelope
}

type oidcRedirectOutput struct {
	Location  string   `header:"Location"`
	SetCookie []string `header:"Set-Cookie"`
}

type authSessionDTO struct {
	AccessTokenExp int64 `json:"accessTokenExp" doc:"Access token expiry as epoch milliseconds"`
}

type passwordLoginInput struct {
	Body struct {
		Identifier string `json:"identifier" minLength:"1"`
		Password   string `json:"password" minLength:"1"`
	}
}

type refreshSessionInput struct {
	RefreshToken string `cookie:"shionlib_refresh_token"`
}

type forgotPasswordInput struct {
	Body struct {
		Email string `json:"email" format:"email"`
	}
}

type checkPasswordResetInput struct {
	Body struct {
		Token string `json:"token" format:"uuid"`
		Email string `json:"email" format:"email"`
	}
}

type resetPasswordInput struct {
	Body struct {
		Password string `json:"password" minLength:"1"`
		Email    string `json:"email" format:"email"`
		Token    string `json:"token" format:"uuid"`
	}
}

type requestCodeInput struct {
	Body struct {
		Email string `json:"email" format:"email"`
	}
}

type verifyCodeInput struct {
	Body struct {
		Code  string `json:"code" minLength:"1"`
		Email string `json:"email" format:"email"`
		UUID  string `json:"uuid" format:"uuid"`
	}
}

type codeRequestedDTO struct {
	UUID string `json:"uuid"`
}

type codeVerifiedDTO struct {
	Verified bool `json:"verified"`
}

type passkeyRegisterOptionsInput struct {
	Body *struct {
		Name *string `json:"name,omitempty" maxLength:"128"`
	}
}

type passkeyRegisterVerifyInput struct {
	Body struct {
		FlowID   string         `json:"flow_id" minLength:"1"`
		Response map[string]any `json:"response"`
		Name     *string        `json:"name,omitempty" maxLength:"128"`
	}
}

type passkeyLoginOptionsInput struct {
	Body *struct {
		Identifier *string `json:"identifier,omitempty"`
	}
}

type passkeyLoginVerifyInput struct {
	Body struct {
		FlowID   string         `json:"flow_id" minLength:"1"`
		Response map[string]any `json:"response"`
	}
}

type passkeyPath struct {
	ID int `path:"id" minimum:"1"`
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

type oidcStartInput struct {
	ReturnTo string `query:"returnTo"`
	Mode     string `query:"mode"`
	Origin   string `query:"origin"`
}

type oidcCallbackInput struct {
	Code        string `query:"code"`
	State       string `query:"state"`
	Error       string `query:"error"`
	Transaction string `cookie:"shionlib_oidc_tx"`
}

type oidcIdentityPath struct {
	ID int `path:"id" minimum:"1"`
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
