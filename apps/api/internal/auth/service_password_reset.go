package auth

import (
	"context"
	"fmt"
	"net/url"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type PasswordResetService struct {
	accounts  Accounts
	store     PasswordResetStore
	mailer    Mailer
	passwords SecretHasher
	sessions  *SessionService
	tx        Transactor
	siteURL   string
}

func NewPasswordResetService(accounts Accounts, store PasswordResetStore, mailer Mailer, passwords SecretHasher, sessions *SessionService, tx Transactor, siteURL string) *PasswordResetService {
	return &PasswordResetService{accounts: accounts, store: store, mailer: mailer, passwords: passwords, sessions: sessions, tx: tx, siteURL: siteURL}
}

func (p *PasswordResetService) Request(ctx context.Context, email string) error {
	if _, found, err := p.accounts.FindByEmail(ctx, email); err != nil {
		return err
	} else if !found {
		return user.ErrNotFound
	}
	token := uuid.NewString()
	if err := p.store.SavePasswordReset(ctx, PasswordReset{Token: token, Email: email}, PasswordResetTTL); err != nil {
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

func (p *PasswordResetService) Check(ctx context.Context, token, email string) (bool, error) {
	stored, found, err := p.store.FindPasswordReset(ctx, token, email)
	if err != nil || !found {
		return false, err
	}
	return stored.matches(token, email), nil
}

func (p *PasswordResetService) Reset(ctx context.Context, token, email, password string) error {
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
	stored, taken, err := p.store.TakePasswordReset(ctx, token, email)
	if err != nil {
		return err
	}
	if !taken || !stored.matches(token, email) {
		return ErrInvalidResetPasswordToken
	}
	return p.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := p.accounts.Update(ctx, account.ID, user.Changes{PasswordHash: &hash}); err != nil {
			return err
		}
		return p.sessions.RevokeUser(ctx, account.ID, reasonPasswordReset)
	})
}

func (p *PasswordResetService) resetLink(token, email string) (string, error) {
	base, err := url.Parse(p.siteURL)
	if err != nil {
		return "", fmt.Errorf("parse site url: %w", err)
	}
	link := base.ResolveReference(&url.URL{Path: passwordResetPath})
	link.RawQuery = "token=" + url.QueryEscape(token) + "&email=" + url.QueryEscape(email)
	return link.String(), nil
}
