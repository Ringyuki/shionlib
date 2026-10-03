package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	PasswordResetTTL  = 10 * time.Minute
	passwordResetPath = "/user/password/forget"
)

type storedReset struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

type PasswordReset struct {
	accounts  Accounts
	store     EphemeralStore
	mailer    Mailer
	passwords SecretHasher
	sessions  *Sessions
	tx        Transactor
	siteURL   string
}

func NewPasswordReset(accounts Accounts, store EphemeralStore, mailer Mailer, passwords SecretHasher, sessions *Sessions, tx Transactor, siteURL string) *PasswordReset {
	return &PasswordReset{accounts: accounts, store: store, mailer: mailer, passwords: passwords, sessions: sessions, tx: tx, siteURL: siteURL}
}

func (p *PasswordReset) Request(ctx context.Context, email string) error {
	if _, found, err := p.accounts.FindByEmail(ctx, email); err != nil {
		return err
	} else if !found {
		return user.ErrNotFound
	}
	token := uuid.NewString()
	raw, err := json.Marshal(storedReset{Email: email, Token: token})
	if err != nil {
		return fmt.Errorf("encode password reset: %w", err)
	}
	if err := p.store.Put(ctx, resetKey(token, email), raw, PasswordResetTTL); err != nil {
		return err
	}
	link, err := p.resetLink(token, email)
	if err != nil {
		return err
	}
	if err := p.mailer.SendPasswordReset(ctx, email, link, PasswordResetTTL); err != nil {
		return fmt.Errorf("send password reset: %w", err)
	}
	return nil
}

func (p *PasswordReset) Check(ctx context.Context, token, email string) (bool, error) {
	raw, found, err := p.store.Get(ctx, resetKey(token, email))
	if err != nil || !found {
		return false, err
	}
	return matchesReset(raw, token, email), nil
}

func (p *PasswordReset) Reset(ctx context.Context, token, email, password string) error {
	valid, err := p.Check(ctx, token, email)
	if err != nil {
		return err
	}
	if !valid {
		return ErrInvalidResetPasswordToken
	}
	account, found, err := p.accounts.FindByEmail(ctx, email)
	if err != nil {
		return err
	}
	if !found {
		return user.ErrNotFound
	}
	hash, err := p.passwords.Hash(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	raw, taken, err := p.store.Take(ctx, resetKey(token, email))
	if err != nil {
		return err
	}
	if !taken || !matchesReset(raw, token, email) {
		return ErrInvalidResetPasswordToken
	}
	return p.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := p.accounts.Update(ctx, account.ID, user.Changes{PasswordHash: &hash}); err != nil {
			return err
		}
		return p.sessions.RevokeUser(ctx, account.ID, reasonPasswordReset)
	})
}

func (p *PasswordReset) resetLink(token, email string) (string, error) {
	base, err := url.Parse(p.siteURL)
	if err != nil {
		return "", fmt.Errorf("parse site url: %w", err)
	}
	link := base.ResolveReference(&url.URL{Path: passwordResetPath})
	link.RawQuery = "token=" + url.QueryEscape(token) + "&email=" + url.QueryEscape(email)
	return link.String(), nil
}

func matchesReset(raw []byte, token, email string) bool {
	var stored storedReset
	if err := json.Unmarshal(raw, &stored); err != nil {
		return false
	}
	return stored.Email == email && stored.Token == token
}

func resetKey(token, email string) string {
	return "password-reset:" + token + ":" + email
}
