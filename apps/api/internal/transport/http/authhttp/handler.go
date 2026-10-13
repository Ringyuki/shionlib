package authhttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const (
	RefreshCookie = "shionlib_refresh_token"
	OIDCTxCookie  = "shionlib_oidc_tx"
	oidcTxMaxAge  = 600
)

type CookieOptions struct {
	Secure        bool
	AccessMaxAge  time.Duration
	RefreshMaxAge time.Duration
}

func (p CookieOptions) cookie(name, value string, maxAge int) string {
	flags := "; HttpOnly; "
	if p.Secure {
		flags += "Secure; "
	}
	return name + "=" + value + flags + "SameSite=Lax; Path=/; Max-Age=" + strconv.Itoa(maxAge)
}

func (p CookieOptions) session(tokens auth.Tokens) []string {
	return []string{
		p.cookie(middleware.AccessTokenCookie, tokens.AccessToken, int(p.AccessMaxAge.Seconds())),
		p.cookie(RefreshCookie, tokens.RefreshToken, int(p.RefreshMaxAge.Seconds())),
	}
}

func (p CookieOptions) cleared() []string {
	return []string{
		p.cookie(middleware.AccessTokenCookie, "", 0),
		p.cookie(RefreshCookie, "", 0),
	}
}

func (p CookieOptions) transaction(tx auth.OIDCTransaction) (string, error) {
	raw, err := json.Marshal(storedTransactionDTO{
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

func (p CookieOptions) clearedTransaction() string {
	return p.cookie(OIDCTxCookie, "", 0)
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

const throttleAuth = "auth"

var tags = []string{"auth"}

type Deps struct {
	Sessions *auth.SessionService
	Login    *auth.LoginService
	Codes    *auth.CodeService
	Reset    *auth.PasswordResetService
	Passkeys *auth.PasskeyService
	OIDC     *auth.OIDCService
}

type Handler struct {
	services Deps
	cookies  CookieOptions
	resp     *response.Builder
	logger   *slog.Logger
}

func NewHandler(services Deps, cookies CookieOptions, resp *response.Builder, logger *slog.Logger) *Handler {
	return &Handler{services: services, cookies: cookies, resp: resp, logger: logger}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "auth.login", Method: http.MethodPost, Path: "/user/login", Summary: "Log in with a password", Tags: tags, Throttle: throttleAuth}, h.login)
	httpapi.Register(api, httpapi.Route{ID: "auth.refresh", Method: http.MethodPost, Path: "/auth/token/refresh", Summary: "Rotate the refresh token", Tags: tags}, h.refresh)
	httpapi.Register(api, httpapi.Route{ID: "auth.logout", Method: http.MethodPost, Path: "/auth/logout", Summary: "Log out and block the session family", Tags: tags, Status: http.StatusOK}, h.logout)
	httpapi.Register(api, httpapi.Route{ID: "auth.password.forget", Method: http.MethodPost, Path: "/auth/password/forget", Summary: "Send a password reset link", Tags: tags, Throttle: throttleAuth}, h.forgotPassword)
	httpapi.Register(api, httpapi.Route{ID: "auth.password.check", Method: http.MethodPost, Path: "/auth/password/forget/check", Summary: "Check a password reset token", Tags: tags, Throttle: throttleAuth}, h.checkPasswordReset)
	httpapi.Register(api, httpapi.Route{ID: "auth.password.reset", Method: http.MethodPost, Path: "/auth/password/forget/reset", Summary: "Reset a password with a reset token", Tags: tags, Throttle: throttleAuth}, h.resetPassword)
	httpapi.Register(api, httpapi.Route{ID: "auth.code.request", Method: http.MethodPost, Path: "/auth/code/request", Summary: "Email a verification code", Tags: tags, Throttle: throttleAuth}, h.requestCode)
	httpapi.Register(api, httpapi.Route{ID: "auth.code.verify", Method: http.MethodPost, Path: "/auth/code/verify", Summary: "Verify and consume a verification code", Tags: tags, Throttle: throttleAuth}, h.verifyCode)
	h.registerPasskeys(api)
	h.registerOIDC(api)
}

func device(ctx context.Context) auth.Device {
	info := clientinfo.From(ctx)
	return auth.Device{IP: info.IP, UserAgent: info.UserAgent}
}

func (h *Handler) session(ctx context.Context, tokens auth.Tokens) *sessionOutputDTO {
	out := response.OK(ctx, h.resp, authSessionDTO{AccessTokenExp: tokens.AccessExpiresAt.UnixMilli()})
	return &sessionOutputDTO{AuthStale: out.AuthStale, SetCookie: h.cookies.session(tokens), Body: out.Body}
}

func (h *Handler) login(ctx context.Context, in *passwordLoginInput) (*sessionOutputDTO, error) {
	tokens, err := h.services.Login.Login(ctx, in.Body.Identifier, in.Body.Password, device(ctx))
	if err != nil {
		return nil, err
	}
	return h.session(ctx, tokens), nil
}

func (h *Handler) refresh(ctx context.Context, in *refreshSessionInput) (*sessionOutputDTO, error) {
	tokens, err := h.services.Sessions.Refresh(ctx, in.RefreshToken, device(ctx))
	if err != nil {
		return nil, err
	}
	return h.session(ctx, tokens), nil
}

func (h *Handler) logout(ctx context.Context, in *refreshSessionInput) (*logoutOutputDTO, error) {
	if err := h.services.Sessions.Logout(ctx, in.RefreshToken); err != nil {
		return nil, err
	}
	out := response.Empty(ctx, h.resp)
	return &logoutOutputDTO{AuthStale: out.AuthStale, SetCookie: h.cookies.cleared(), Body: out.Body}, nil
}

func (h *Handler) forgotPassword(ctx context.Context, in *forgotPasswordInput) (*response.EmptyOutput, error) {
	if err := h.services.Reset.Request(ctx, in.Body.Email); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) checkPasswordReset(ctx context.Context, in *checkPasswordResetInput) (*response.Output[bool], error) {
	valid, err := h.services.Reset.Check(ctx, in.Body.Token, in.Body.Email)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, valid), nil
}

func (h *Handler) resetPassword(ctx context.Context, in *resetPasswordInput) (*response.EmptyOutput, error) {
	if err := h.services.Reset.Reset(ctx, in.Body.Token, in.Body.Email, in.Body.Password); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) requestCode(ctx context.Context, in *requestCodeInput) (*response.Output[codeRequestedDTO], error) {
	id, err := h.services.Codes.Request(ctx, in.Body.Email, 0)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, codeRequestedDTO{UUID: id}), nil
}

func (h *Handler) verifyCode(ctx context.Context, in *verifyCodeInput) (*response.Output[codeVerifiedDTO], error) {
	if err := h.services.Codes.Verify(ctx, in.Body.UUID, in.Body.Email, in.Body.Code); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, codeVerifiedDTO{Verified: true}), nil
}

func (h *Handler) registerPasskeys(api *httpapi.API) {
	passkeyTags := []string{"auth", "passkey"}
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.registerOptions", Method: http.MethodPost, Path: "/auth/passkey/register/options", Summary: "Start a passkey registration", Tags: passkeyTags, Access: httpapi.AccessUser}, h.passkeyRegisterOptions)
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.registerVerify", Method: http.MethodPost, Path: "/auth/passkey/register/verify", Summary: "Finish a passkey registration", Tags: passkeyTags, Access: httpapi.AccessUser}, h.passkeyRegisterVerify)
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.loginOptions", Method: http.MethodPost, Path: "/auth/passkey/login/options", Summary: "Start a passkey login", Tags: passkeyTags, Throttle: throttleAuth}, h.passkeyLoginOptions)
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.loginVerify", Method: http.MethodPost, Path: "/auth/passkey/login/verify", Summary: "Finish a passkey login", Tags: passkeyTags, Throttle: throttleAuth}, h.passkeyLoginVerify)
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.list", Method: http.MethodGet, Path: "/auth/passkey", Summary: "List the caller's passkeys", Tags: passkeyTags, Access: httpapi.AccessUser}, h.passkeyList)
	httpapi.Register(api, httpapi.Route{ID: "auth.passkey.revoke", Method: http.MethodDelete, Path: "/auth/passkey/{id}", Summary: "Revoke a passkey", Tags: passkeyTags, Access: httpapi.AccessUser}, h.passkeyRevoke)
}

func (h *Handler) passkeyRegisterOptions(ctx context.Context, in *passkeyRegisterOptionsInput) (*response.Output[passkeyFlowDTO], error) {
	var name *string
	if in.Body != nil {
		name = in.Body.Name
	}
	flow, err := h.services.Passkeys.RegisterOptions(ctx, actor.From(ctx), name)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, passkeyFlowDTO{FlowID: flow.FlowID, Options: flow.Options}), nil
}

func (h *Handler) passkeyRegisterVerify(ctx context.Context, in *passkeyRegisterVerifyInput) (*response.Output[passkeyCreatedDTO], error) {
	raw, err := json.Marshal(in.Body.Response)
	if err != nil {
		return nil, fmt.Errorf("encode passkey response: %w", err)
	}
	created, err := h.services.Passkeys.RegisterVerify(ctx, actor.From(ctx), in.Body.FlowID, raw, in.Body.Name)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, passkeyCreatedDTO{
		ID:                 created.ID,
		CredentialID:       created.CredentialID,
		Name:               created.Name,
		DeviceType:         created.DeviceType,
		CredentialBackedUp: created.BackedUp,
		Created:            created.Created,
	}), nil
}

func (h *Handler) passkeyLoginOptions(ctx context.Context, in *passkeyLoginOptionsInput) (*response.Output[passkeyFlowDTO], error) {
	identifier := ""
	if in.Body != nil && in.Body.Identifier != nil {
		identifier = *in.Body.Identifier
	}
	flow, err := h.services.Passkeys.LoginOptions(ctx, identifier)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, passkeyFlowDTO{FlowID: flow.FlowID, Options: flow.Options}), nil
}

func (h *Handler) passkeyLoginVerify(ctx context.Context, in *passkeyLoginVerifyInput) (*sessionOutputDTO, error) {
	raw, err := json.Marshal(in.Body.Response)
	if err != nil {
		return nil, fmt.Errorf("encode passkey response: %w", err)
	}
	tokens, err := h.services.Passkeys.LoginVerify(ctx, in.Body.FlowID, raw, device(ctx))
	if err != nil {
		return nil, err
	}
	return h.session(ctx, tokens), nil
}

func (h *Handler) passkeyList(ctx context.Context, _ *struct{}) (*response.Output[[]passkeyDTO], error) {
	keys, err := h.services.Passkeys.List(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	out := make([]passkeyDTO, len(keys))
	for i, key := range keys {
		out[i] = toPasskeyDTO(key)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) passkeyRevoke(ctx context.Context, in *passkeyPathInput) (*response.Output[passkeyRevokedDTO], error) {
	if err := h.services.Passkeys.Revoke(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, passkeyRevokedDTO{ID: in.ID}), nil
}

func (h *Handler) registerOIDC(api *httpapi.API) {
	oidcTags := []string{"auth", "oidc"}
	httpapi.Register(api, httpapi.Route{ID: "auth.oidc.start", Method: http.MethodGet, Path: "/auth/oidc/start", Summary: "Redirect to Hikarinagi ID", Tags: oidcTags, Status: http.StatusFound}, h.oidcStart)
	httpapi.Register(api, httpapi.Route{ID: "auth.oidc.callback", Method: http.MethodGet, Path: "/auth/oidc/callback", Summary: "Complete a Hikarinagi ID login or link", Tags: oidcTags, Status: http.StatusFound}, h.oidcCallback)
	httpapi.Register(api, httpapi.Route{ID: "auth.oidc.identities", Method: http.MethodGet, Path: "/auth/oidc/identities", Summary: "List linked Hikarinagi ID identities", Tags: oidcTags, Access: httpapi.AccessUser}, h.oidcIdentities)
	httpapi.Register(api, httpapi.Route{ID: "auth.oidc.unlink", Method: http.MethodDelete, Path: "/auth/oidc/identities/{id}", Summary: "Unlink a Hikarinagi ID identity", Tags: oidcTags, Access: httpapi.AccessUser}, h.oidcUnlink)
}

func (h *Handler) oidcStart(_ context.Context, in *oidcStartInput) (*oidcRedirectOutputDTO, error) {
	location, tx, err := h.services.OIDC.Start(in.ReturnTo, in.Mode, in.Origin)
	if err != nil {
		return nil, err
	}
	cookie, err := h.cookies.transaction(tx)
	if err != nil {
		return nil, fmt.Errorf("encode oidc transaction: %w", err)
	}
	return &oidcRedirectOutputDTO{Location: location, SetCookie: []string{cookie}}, nil
}

func (h *Handler) oidcCallback(ctx context.Context, in *oidcCallbackInput) (*oidcRedirectOutputDTO, error) {
	tx := parseTransaction(in.Transaction)
	returnTo := "/"
	if tx != nil {
		returnTo = tx.ReturnTo
	}
	cookies := []string{h.cookies.clearedTransaction()}
	result, err := h.services.OIDC.Callback(ctx, actor.From(ctx), auth.CallbackInput{Code: in.Code, State: in.State, ProviderErr: in.Error, Transaction: tx}, device(ctx))
	if err != nil {
		reason := auth.OIDCReasonProvider
		var flow *auth.OIDCError
		if errors.As(err, &flow) {
			reason = flow.Reason
		}
		if reason == auth.OIDCReasonProvider || reason == auth.OIDCReasonExchange {
			h.logger.WarnContext(ctx, "oidc callback failed", slog.String("reason", reason), slog.Any("error", err))
		}
		return &oidcRedirectOutputDTO{Location: auth.WithQuery(returnTo, "oidc_error", reason), SetCookie: cookies}, nil
	}
	if result.Mode == auth.OIDCModeLink {
		return &oidcRedirectOutputDTO{Location: auth.WithQuery(returnTo, "oidc_linked", "1"), SetCookie: cookies}, nil
	}
	return &oidcRedirectOutputDTO{Location: auth.WithQuery(returnTo, "oidc_login", "1"), SetCookie: append(cookies, h.cookies.session(result.Tokens)...)}, nil
}

func (h *Handler) oidcIdentities(ctx context.Context, _ *struct{}) (*response.Output[oidcIdentitiesDTO], error) {
	list, err := h.services.OIDC.Identities(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	out := oidcIdentitiesDTO{Items: make([]oidcIdentityDTO, len(list.Items)), CanUnlink: list.CanUnlink}
	for i, item := range list.Items {
		out.Items[i] = oidcIdentityDTO{ID: item.ID, Provider: item.Provider, EmailAtLink: item.EmailAtLink, Created: item.Created}
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) oidcUnlink(ctx context.Context, in *oidcIdentityPathInput) (*response.EmptyOutput, error) {
	if err := h.services.OIDC.Unlink(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
