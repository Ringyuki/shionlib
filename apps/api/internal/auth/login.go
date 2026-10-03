package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type PasswordLogin struct {
	accounts  Accounts
	passwords SecretHasher
	sessions  *Sessions
	now       func() time.Time
}

func NewPasswordLogin(accounts Accounts, passwords SecretHasher, sessions *Sessions, now func() time.Time) *PasswordLogin {
	return &PasswordLogin{accounts: accounts, passwords: passwords, sessions: sessions, now: now}
}

func (l *PasswordLogin) Login(ctx context.Context, identifier, password string, device Device) (Tokens, error) {
	account, found, err := l.accounts.FindByIdentifier(ctx, identifier)
	if err != nil {
		return Tokens{}, err
	}
	if !found {
		return Tokens{}, user.ErrNotFound
	}
	if account.Banned() {
		return Tokens{}, user.ErrBanned
	}
	if !account.HasPassword() {
		return Tokens{}, user.ErrInvalidPassword
	}
	ok, err := l.passwords.Verify(*account.PasswordHash, password)
	if err != nil {
		return Tokens{}, fmt.Errorf("verify password: %w", err)
	}
	if !ok {
		return Tokens{}, user.ErrInvalidPassword
	}
	return issueLogin(ctx, l.sessions, l.accounts, account, device, l.now())
}

func issueLogin(ctx context.Context, sessions *Sessions, accounts Accounts, account user.User, device Device, at time.Time) (Tokens, error) {
	tokens, err := sessions.Issue(ctx, PrincipalOf(account), device)
	if err != nil {
		return Tokens{}, err
	}
	if err := accounts.Update(ctx, account.ID, user.Changes{LastLoginAt: &at}); err != nil {
		return Tokens{}, err
	}
	return tokens, nil
}
