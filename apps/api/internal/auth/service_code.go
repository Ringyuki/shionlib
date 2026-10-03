package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type CodeService struct {
	store  VerificationCodeStore
	mailer Mailer
	now    func() time.Time
}

func NewCodeService(store VerificationCodeStore, mailer Mailer, now func() time.Time) *CodeService {
	return &CodeService{store: store, mailer: mailer, now: now}
}

func (c *CodeService) Request(ctx context.Context, email string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = DefaultCodeTTL
	}
	code, err := newVerificationCode()
	if err != nil {
		return "", err
	}
	id := uuid.NewString()
	if err := c.store.SaveVerificationCode(ctx, id, VerificationCode{Email: email, Code: code, Created: c.now()}, ttl); err != nil {
		return "", err
	}
	if err := c.mailer.SendVerificationCode(ctx, email, code, ttl); err != nil {
		return "", fmt.Errorf("send verification code: %w", err)
	}
	return id, nil
}

func (c *CodeService) Check(ctx context.Context, id, email, code string) error {
	stored, found, err := c.store.FindVerificationCode(ctx, id, email)
	if err != nil {
		return err
	}
	if !found {
		return ErrVerificationCodeNotFound
	}
	if stored.Email != email || subtle.ConstantTimeCompare([]byte(stored.Code), []byte(code)) != 1 {
		return ErrVerificationCodeMismatch
	}
	return nil
}

func (c *CodeService) Consume(ctx context.Context, id, email string) error {
	_, found, err := c.store.TakeVerificationCode(ctx, id, email)
	if err != nil {
		return err
	}
	if !found {
		return ErrVerificationCodeNotFound
	}
	return nil
}

func (c *CodeService) Verify(ctx context.Context, id, email, code string) error {
	if err := c.Check(ctx, id, email, code); err != nil {
		return err
	}
	return c.Consume(ctx, id, email)
}

func newVerificationCode() (string, error) {
	raw := make([]byte, 3)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate verification code: %w", err)
	}
	return strings.ToUpper(hex.EncodeToString(raw)), nil
}
