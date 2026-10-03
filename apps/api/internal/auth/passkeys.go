package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var ErrPasskeyExists = errors.New("passkey credential already registered")

const (
	challengeRegister = "register"
	challengeLogin    = "login"
)

type storedChallenge struct {
	Kind          string `json:"kind"`
	State         []byte `json:"state"`
	UserID        int    `json:"user_id,omitempty"`
	SuggestedName string `json:"suggested_name,omitempty"`
}

type PasskeyFlow struct {
	FlowID  string
	Options json.RawMessage
}

type Passkeys struct {
	accounts     Accounts
	repo         PasskeyRepository
	ceremony     PasskeyCeremony
	store        EphemeralStore
	sessions     *Sessions
	tx           Transactor
	now          func() time.Time
	challengeTTL time.Duration
}

func NewPasskeys(accounts Accounts, repo PasskeyRepository, ceremony PasskeyCeremony, store EphemeralStore, sessions *Sessions, tx Transactor, now func() time.Time, challengeTTL time.Duration) *Passkeys {
	return &Passkeys{accounts: accounts, repo: repo, ceremony: ceremony, store: store, sessions: sessions, tx: tx, now: now, challengeTTL: challengeTTL}
}

func (p *Passkeys) RegisterOptions(ctx context.Context, who actor.Actor, suggestedName *string) (PasskeyFlow, error) {
	account, err := p.accounts.Get(ctx, who.UserID)
	if err != nil {
		return PasskeyFlow{}, err
	}
	if account.Banned() {
		return PasskeyFlow{}, user.ErrBanned
	}
	existing, err := p.repo.ActivePasskeys(ctx, account.ID)
	if err != nil {
		return PasskeyFlow{}, err
	}
	challenge, err := p.ceremony.BeginRegistration(ownerOf(account), existing)
	if err != nil {
		return PasskeyFlow{}, fmt.Errorf("begin passkey registration: %w", err)
	}
	stored := storedChallenge{Kind: challengeRegister, State: challenge.State, UserID: account.ID}
	if suggestedName != nil {
		stored.SuggestedName = *suggestedName
	}
	return p.saveChallenge(ctx, stored, challenge.Options)
}

func (p *Passkeys) RegisterVerify(ctx context.Context, who actor.Actor, flowID string, response json.RawMessage, name *string) (Passkey, error) {
	state, err := p.takeChallenge(ctx, flowID, challengeRegister)
	if err != nil {
		return Passkey{}, ErrUnauthorized.Wrap(err)
	}
	if state.UserID != who.UserID {
		return Passkey{}, ErrUnauthorized
	}
	account, err := p.accounts.Get(ctx, state.UserID)
	if err != nil {
		return Passkey{}, err
	}
	registered, err := p.ceremony.FinishRegistration(ownerOf(account), state.State, response)
	if err != nil {
		return Passkey{}, ErrUnauthorized.Wrap(err)
	}
	label := state.SuggestedName
	if name != nil && *name != "" {
		label = *name
	}
	now := p.now()
	var created Passkey
	err = p.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created, err = p.repo.CreatePasskey(ctx, NewPasskey{
			UserID:       account.ID,
			CredentialID: registered.CredentialID,
			PublicKey:    registered.PublicKey,
			Counter:      registered.Counter,
			Transports:   registered.Transports,
			AAGUID:       registered.AAGUID,
			DeviceType:   registered.DeviceType,
			BackedUp:     registered.BackedUp,
			Name:         optional(strings.TrimSpace(label)),
			LastUsedAt:   now,
		})
		if err != nil {
			return err
		}
		enabled := true
		return p.accounts.Update(ctx, account.ID, user.Changes{TwoFactorEnabled: &enabled})
	})
	if errors.Is(err, ErrPasskeyExists) {
		return Passkey{}, ErrUnauthorized.Wrap(err)
	}
	return created, err
}

func (p *Passkeys) LoginOptions(ctx context.Context, identifier string) (PasskeyFlow, error) {
	identifier = strings.TrimSpace(identifier)
	stored := storedChallenge{Kind: challengeLogin}
	var (
		owner *PasskeyOwner
		allow []Passkey
	)
	if identifier != "" {
		account, found, err := p.accounts.FindByIdentifier(ctx, identifier)
		if err != nil {
			return PasskeyFlow{}, err
		}
		if !found {
			return PasskeyFlow{}, user.ErrNotFound
		}
		if account.Banned() {
			return PasskeyFlow{}, user.ErrBanned
		}
		resolved := ownerOf(account)
		owner = &resolved
		stored.UserID = account.ID
		if allow, err = p.repo.ActivePasskeys(ctx, account.ID); err != nil {
			return PasskeyFlow{}, err
		}
	}
	challenge, err := p.ceremony.BeginLogin(owner, allow)
	if err != nil {
		return PasskeyFlow{}, fmt.Errorf("begin passkey login: %w", err)
	}
	stored.State = challenge.State
	return p.saveChallenge(ctx, stored, challenge.Options)
}

func (p *Passkeys) LoginVerify(ctx context.Context, flowID string, response json.RawMessage, device Device) (Tokens, error) {
	state, err := p.takeChallenge(ctx, flowID, challengeLogin)
	if err != nil {
		return Tokens{}, ErrForbidden.Wrap(err)
	}
	credentialID, err := p.ceremony.CredentialID(response)
	if err != nil {
		return Tokens{}, ErrForbidden.Wrap(err)
	}
	credential, found, err := p.repo.FindActivePasskey(ctx, credentialID)
	if err != nil {
		return Tokens{}, err
	}
	if !found || (state.UserID != 0 && credential.UserID != state.UserID) {
		return Tokens{}, ErrForbidden
	}
	account, err := p.accounts.Get(ctx, credential.UserID)
	if errors.Is(err, user.ErrNotFound) {
		return Tokens{}, ErrForbidden.Wrap(err)
	}
	if err != nil {
		return Tokens{}, err
	}
	if account.Banned() {
		return Tokens{}, user.ErrBanned
	}
	owned, err := p.repo.ActivePasskeys(ctx, account.ID)
	if err != nil {
		return Tokens{}, err
	}
	assertion, err := p.ceremony.FinishLogin(state.State, ownerOf(account), owned, response)
	if err != nil {
		return Tokens{}, ErrForbidden.Wrap(err)
	}
	now := p.now()
	if err := p.repo.RecordPasskeyUse(ctx, credential.ID, PasskeyUse{Counter: assertion.Counter, DeviceType: assertion.DeviceType, BackedUp: assertion.BackedUp, At: now}); err != nil {
		return Tokens{}, err
	}
	return issueLogin(ctx, p.sessions, p.accounts, account, device, now)
}

func (p *Passkeys) List(ctx context.Context, who actor.Actor) ([]Passkey, error) {
	keys, err := p.repo.ActivePasskeys(ctx, who.UserID)
	if err != nil {
		return nil, err
	}
	sortByRecentUse(keys)
	return keys, nil
}

func (p *Passkeys) Revoke(ctx context.Context, who actor.Actor, id int) error {
	return p.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		revoked, err := p.repo.RevokePasskey(ctx, id, who.UserID, p.now())
		if err != nil {
			return err
		}
		if !revoked {
			return user.ErrNotFound
		}
		remaining, err := p.repo.CountActivePasskeys(ctx, who.UserID)
		if err != nil {
			return err
		}
		if remaining > 0 {
			return nil
		}
		disabled := false
		return p.accounts.Update(ctx, who.UserID, user.Changes{TwoFactorEnabled: &disabled})
	})
}

func (p *Passkeys) saveChallenge(ctx context.Context, stored storedChallenge, options json.RawMessage) (PasskeyFlow, error) {
	raw, err := json.Marshal(stored)
	if err != nil {
		return PasskeyFlow{}, fmt.Errorf("encode passkey challenge: %w", err)
	}
	flowID := uuid.NewString()
	if err := p.store.Put(ctx, challengeKey(flowID), raw, p.challengeTTL); err != nil {
		return PasskeyFlow{}, err
	}
	return PasskeyFlow{FlowID: flowID, Options: options}, nil
}

func (p *Passkeys) takeChallenge(ctx context.Context, flowID, kind string) (storedChallenge, error) {
	raw, found, err := p.store.Take(ctx, challengeKey(flowID))
	if err != nil {
		return storedChallenge{}, err
	}
	if !found {
		return storedChallenge{}, errors.New("passkey challenge not found")
	}
	var stored storedChallenge
	if err := json.Unmarshal(raw, &stored); err != nil {
		return storedChallenge{}, fmt.Errorf("decode passkey challenge: %w", err)
	}
	if stored.Kind != kind {
		return storedChallenge{}, fmt.Errorf("passkey challenge is for %s", stored.Kind)
	}
	return stored, nil
}

func challengeKey(flowID string) string {
	return "passkey:challenge:" + flowID
}

func ownerOf(account user.User) PasskeyOwner {
	return PasskeyOwner{UserID: account.ID, Name: account.Email, DisplayName: account.Name}
}

func sortByRecentUse(keys []Passkey) {
	slices.SortStableFunc(keys, func(a, b Passkey) int {
		switch {
		case a.LastUsedAt == nil && b.LastUsedAt != nil:
			return -1
		case a.LastUsedAt != nil && b.LastUsedAt == nil:
			return 1
		case a.LastUsedAt != nil && b.LastUsedAt != nil && !a.LastUsedAt.Equal(*b.LastUsedAt):
			return b.LastUsedAt.Compare(*a.LastUsedAt)
		}
		if c := b.Created.Compare(a.Created); c != 0 {
			return c
		}
		return b.ID - a.ID
	})
}
