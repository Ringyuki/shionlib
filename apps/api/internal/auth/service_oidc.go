package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func oidcFailure(reason string, cause error) *OIDCError {
	return &OIDCError{Reason: reason, Err: cause}
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

type OIDCService struct {
	idp            IdentityProvider
	identities     IdentityRepository
	passkeys       PasskeyRepository
	accounts       Accounts
	sessions       *SessionService
	tx             Transactor
	now            func() time.Time
	allowedOrigins []string
}

func NewOIDCService(idp IdentityProvider, identities IdentityRepository, passkeys PasskeyRepository, accounts Accounts, sessions *SessionService, tx Transactor, now func() time.Time, allowedOrigins []string) *OIDCService {
	return &OIDCService{idp: idp, identities: identities, passkeys: passkeys, accounts: accounts, sessions: sessions, tx: tx, now: now, allowedOrigins: allowedOrigins}
}

func (o *OIDCService) Start(returnTo, mode, origin string) (string, OIDCTransaction, error) {
	verifier, err := randomToken(32)
	if err != nil {
		return "", OIDCTransaction{}, err
	}
	state, err := randomToken(16)
	if err != nil {
		return "", OIDCTransaction{}, err
	}
	nonce, err := randomToken(16)
	if err != nil {
		return "", OIDCTransaction{}, err
	}
	digest := sha256.Sum256([]byte(verifier))
	tx := OIDCTransaction{
		Verifier:    verifier,
		State:       state,
		ReturnTo:    SafeReturnTo(returnTo),
		Mode:        ParseOIDCMode(mode),
		RedirectURI: o.redirectURI(origin),
		Nonce:       nonce,
	}
	authorizeURL := o.idp.AuthorizeURL(AuthorizeRequest{
		RedirectURI:   tx.RedirectURI,
		State:         state,
		CodeChallenge: base64.RawURLEncoding.EncodeToString(digest[:]),
		Nonce:         nonce,
	})
	return authorizeURL, tx, nil
}

func (o *OIDCService) Callback(ctx context.Context, who actor.Actor, in CallbackInput, device Device) (CallbackResult, error) {
	tx := in.Transaction
	if in.ProviderErr != "" || in.Code == "" || in.State == "" || tx == nil || tx.State != in.State || tx.Nonce == "" || tx.Verifier == "" {
		return CallbackResult{}, oidcFailure(OIDCReasonState, nil)
	}
	if tx.Mode == OIDCModeLink {
		if !who.Authenticated() {
			return CallbackResult{Mode: OIDCModeLink}, oidcFailure(OIDCReasonLinkAuth, nil)
		}
		return CallbackResult{Mode: OIDCModeLink}, asOIDCFailure(o.link(ctx, who.UserID, *tx, in.Code))
	}
	tokens, err := o.login(ctx, *tx, in.Code, device)
	return CallbackResult{Mode: OIDCModeLogin, Tokens: tokens}, asOIDCFailure(err)
}

func (o *OIDCService) Identities(ctx context.Context, who actor.Actor) (IdentityList, error) {
	items, err := o.identities.ListIdentities(ctx, who.UserID)
	if err != nil {
		return IdentityList{}, err
	}
	canUnlink, err := o.hasOtherLoginMethod(ctx, who.UserID, len(items))
	if err != nil {
		return IdentityList{}, err
	}
	return IdentityList{Items: items, CanUnlink: canUnlink}, nil
}

func (o *OIDCService) Unlink(ctx context.Context, who actor.Actor, id int) error {
	identity, found, err := o.identities.GetIdentity(ctx, id)
	if err != nil {
		return err
	}
	if !found || identity.UserID != who.UserID {
		return ErrOIDCIdentityNotFound
	}
	links, err := o.identities.CountIdentities(ctx, who.UserID)
	if err != nil {
		return err
	}
	allowed, err := o.hasOtherLoginMethod(ctx, who.UserID, links)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrOIDCLastLoginMethod
	}
	return o.identities.DeleteIdentity(ctx, id)
}

func (o *OIDCService) hasOtherLoginMethod(ctx context.Context, userID, links int) (bool, error) {
	if links > 1 {
		return true, nil
	}
	account, err := o.accounts.Get(ctx, userID)
	if err != nil {
		return false, err
	}
	if account.HasPassword() {
		return true, nil
	}
	keys, err := o.passkeys.CountActivePasskeys(ctx, userID)
	if err != nil {
		return false, err
	}
	return keys > 0, nil
}

func (o *OIDCService) login(ctx context.Context, tx OIDCTransaction, code string, device Device) (Tokens, error) {
	claims, err := o.exchange(ctx, tx, code)
	if err != nil {
		return Tokens{}, err
	}
	account, err := o.resolve(ctx, claims)
	if err != nil {
		return Tokens{}, err
	}
	if account.Banned() {
		return Tokens{}, oidcFailure(OIDCReasonBanned, nil)
	}
	return issueLogin(ctx, o.sessions, o.accounts, account, device, o.now())
}

func (o *OIDCService) link(ctx context.Context, userID int, tx OIDCTransaction, code string) error {
	claims, err := o.exchange(ctx, tx, code)
	if err != nil {
		return err
	}
	existing, found, err := o.identities.FindIdentity(ctx, OIDCProvider, claims.Subject)
	if err != nil {
		return err
	}
	if !found {
		err = o.identities.CreateIdentity(ctx, o.newIdentity(userID, claims))
		if !errors.Is(err, ErrIdentityExists) {
			return err
		}
		if existing, found, err = o.identities.FindIdentity(ctx, OIDCProvider, claims.Subject); err != nil || !found {
			return errors.Join(ErrIdentityExists, err)
		}
	}
	if existing.UserID != userID {
		return oidcFailure(OIDCReasonLinkConflict, nil)
	}
	return nil
}

func (o *OIDCService) exchange(ctx context.Context, tx OIDCTransaction, code string) (IdentityClaims, error) {
	claims, err := o.idp.Exchange(ctx, CodeExchange{Code: code, Verifier: tx.Verifier, RedirectURI: tx.RedirectURI, Nonce: tx.Nonce})
	if err != nil {
		return IdentityClaims{}, oidcFailure(OIDCReasonExchange, err)
	}
	if claims.Subject == "" {
		return IdentityClaims{}, oidcFailure(OIDCReasonExchange, errors.New("id token has no subject"))
	}
	return claims, nil
}

func (o *OIDCService) resolve(ctx context.Context, claims IdentityClaims) (user.User, error) {
	if account, found, err := o.linkedAccount(ctx, claims.Subject); err != nil || found {
		return account, err
	}
	if claims.Email == "" || !claims.EmailVerified {
		return user.User{}, oidcFailure(OIDCReasonEmailUnverified, nil)
	}
	existing, found, err := o.accounts.FindByEmailFold(ctx, claims.Email)
	if err != nil {
		return user.User{}, err
	}
	if found {
		return o.attach(ctx, existing, claims)
	}
	created, err := o.provision(ctx, claims)
	if errors.Is(err, ErrIdentityExists) {
		if account, found, findErr := o.linkedAccount(ctx, claims.Subject); findErr != nil || found {
			return account, findErr
		}
	}
	return created, err
}

func (o *OIDCService) attach(ctx context.Context, existing user.User, claims IdentityClaims) (user.User, error) {
	if existing.Banned() {
		return user.User{}, oidcFailure(OIDCReasonBanned, nil)
	}
	if existing.Role >= actor.RoleAdmin {
		return user.User{}, oidcFailure(OIDCReasonLinkRequired, nil)
	}
	err := o.identities.CreateIdentity(ctx, o.newIdentity(existing.ID, claims))
	if errors.Is(err, ErrIdentityExists) {
		if account, found, findErr := o.linkedAccount(ctx, claims.Subject); findErr != nil || found {
			return account, findErr
		}
	}
	if err != nil {
		return user.User{}, err
	}
	return existing, nil
}

func (o *OIDCService) provision(ctx context.Context, claims IdentityClaims) (user.User, error) {
	name, err := o.allocateName(ctx, claims)
	if err != nil {
		return user.User{}, err
	}
	verifiedAt := o.now()
	var created user.User
	err = o.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created, err = o.accounts.Create(ctx, user.NewUser{
			Name:            name,
			Email:           claims.Email,
			Lang:            user.LangEN,
			ContentLimit:    actor.ContentLimitNeverShow,
			EmailVerifiedAt: &verifiedAt,
		})
		if err != nil {
			return err
		}
		return o.identities.CreateIdentity(ctx, o.newIdentity(created.ID, claims))
	})
	return created, err
}

func (o *OIDCService) linkedAccount(ctx context.Context, subject string) (user.User, bool, error) {
	identity, found, err := o.identities.FindIdentity(ctx, OIDCProvider, subject)
	if err != nil || !found {
		return user.User{}, false, err
	}
	if err := o.identities.TouchIdentity(ctx, identity.ID, o.now()); err != nil {
		return user.User{}, false, err
	}
	account, err := o.accounts.Get(ctx, identity.UserID)
	if err != nil {
		return user.User{}, false, err
	}
	return account, true, nil
}

func (o *OIDCService) newIdentity(userID int, claims IdentityClaims) NewIdentity {
	return NewIdentity{UserID: userID, Provider: OIDCProvider, Subject: claims.Subject, EmailAtLink: optional(claims.Email), LastLoginAt: o.now()}
}

func (o *OIDCService) allocateName(ctx context.Context, claims IdentityClaims) (string, error) {
	base := nameCandidate(claims)
	for attempt := range nameAttempts {
		candidate := base
		if attempt > 0 {
			suffix, err := randomInt(1000, 10000)
			if err != nil {
				return "", err
			}
			candidate = truncateRunes(truncateRunes(base, nameSuffixedRunes)+strconv.Itoa(suffix), user.MaxNameLength)
		}
		taken, err := o.accounts.NameExists(ctx, candidate)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
	}
	suffix, err := randomInt(10000000, 100000000)
	if err != nil {
		return "", err
	}
	return "user_" + strconv.Itoa(suffix), nil
}

func (o *OIDCService) redirectURI(origin string) string {
	if len(o.allowedOrigins) == 0 {
		return oidcCallbackPath
	}
	chosen := o.allowedOrigins[0]
	if origin != "" && slices.Contains(o.allowedOrigins, origin) {
		chosen = origin
	}
	return chosen + oidcCallbackPath
}

func asOIDCFailure(err error) error {
	if err == nil {
		return nil
	}
	var flow *OIDCError
	if errors.As(err, &flow) {
		return flow
	}
	return oidcFailure(OIDCReasonProvider, err)
}

func randomToken(size int) (string, error) {
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate random token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func randomInt(low, high int) (int, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(high-low)))
	if err != nil {
		return 0, fmt.Errorf("generate random number: %w", err)
	}
	return low + int(n.Int64()), nil
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
