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

type PasskeyService struct {
	accounts     Accounts
	repo         PasskeyRepository
	ceremony     PasskeyCeremony
	store        PasskeyChallengeStore
	sessions     *SessionService
	tx           Transactor
	now          func() time.Time
	challengeTTL time.Duration
}

func NewPasskeyService(accounts Accounts, repo PasskeyRepository, ceremony PasskeyCeremony, store PasskeyChallengeStore, sessions *SessionService, tx Transactor, now func() time.Time, challengeTTL time.Duration) *PasskeyService {
	return &PasskeyService{accounts: accounts, repo: repo, ceremony: ceremony, store: store, sessions: sessions, tx: tx, now: now, challengeTTL: challengeTTL}
}

func (p *PasskeyService) RegisterOptions(ctx context.Context, who actor.Actor, suggestedName *string) (PasskeyFlow, error) {
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
	stored := PendingPasskeyChallenge{Kind: challengeRegister, State: challenge.State, UserID: account.ID}
	if suggestedName != nil {
		stored.SuggestedName = *suggestedName
	}
	return p.saveChallenge(ctx, stored, challenge.Options)
}

func (p *PasskeyService) RegisterVerify(ctx context.Context, who actor.Actor, flowID string, response json.RawMessage, name *string) (Passkey, error) {
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

func (p *PasskeyService) LoginOptions(ctx context.Context, identifier string) (PasskeyFlow, error) {
	identifier = strings.TrimSpace(identifier)
	stored := PendingPasskeyChallenge{Kind: challengeLogin}
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

func (p *PasskeyService) LoginVerify(ctx context.Context, flowID string, response json.RawMessage, device Device) (Tokens, error) {
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

func (p *PasskeyService) List(ctx context.Context, who actor.Actor) ([]Passkey, error) {
	keys, err := p.repo.ActivePasskeys(ctx, who.UserID)
	if err != nil {
		return nil, err
	}
	sortByRecentUse(keys)
	return keys, nil
}

func (p *PasskeyService) Revoke(ctx context.Context, who actor.Actor, id int) error {
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

func (p *PasskeyService) saveChallenge(ctx context.Context, stored PendingPasskeyChallenge, options json.RawMessage) (PasskeyFlow, error) {
	flowID := uuid.NewString()
	if err := p.store.SavePasskeyChallenge(ctx, flowID, stored, p.challengeTTL); err != nil {
		return PasskeyFlow{}, err
	}
	return PasskeyFlow{FlowID: flowID, Options: options}, nil
}

func (p *PasskeyService) takeChallenge(ctx context.Context, flowID, kind string) (PendingPasskeyChallenge, error) {
	stored, found, err := p.store.TakePasskeyChallenge(ctx, flowID)
	if err != nil {
		return PendingPasskeyChallenge{}, err
	}
	if !found {
		return PendingPasskeyChallenge{}, errors.New("passkey challenge not found")
	}
	if stored.Kind != kind {
		return PendingPasskeyChallenge{}, fmt.Errorf("passkey challenge is for %s", stored.Kind)
	}
	return stored, nil
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
