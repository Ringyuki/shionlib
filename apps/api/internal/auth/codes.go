package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const DefaultCodeTTL = 10 * time.Minute

type storedCode struct {
	Email     string `json:"email"`
	Code      string `json:"code"`
	CreatedAt int64  `json:"createdAt"`
}

type Codes struct {
	store  EphemeralStore
	mailer Mailer
	now    func() time.Time
}

func NewCodes(store EphemeralStore, mailer Mailer, now func() time.Time) *Codes {
	return &Codes{store: store, mailer: mailer, now: now}
}

func (c *Codes) Request(ctx context.Context, email string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = DefaultCodeTTL
	}
	code, err := newVerificationCode()
	if err != nil {
		return "", err
	}
	id := uuid.NewString()
	raw, err := json.Marshal(storedCode{Email: email, Code: code, CreatedAt: c.now().UnixMilli()})
	if err != nil {
		return "", fmt.Errorf("encode verification code: %w", err)
	}
	if err := c.store.Put(ctx, codeKey(id, email), raw, ttl); err != nil {
		return "", err
	}
	if err := c.mailer.SendVerificationCode(ctx, email, code, ttl); err != nil {
		return "", fmt.Errorf("send verification code: %w", err)
	}
	return id, nil
}

func (c *Codes) Check(ctx context.Context, id, email, code string) error {
	raw, found, err := c.store.Get(ctx, codeKey(id, email))
	if err != nil {
		return err
	}
	if !found {
		return ErrVerificationCodeNotFound
	}
	var stored storedCode
	if err := json.Unmarshal(raw, &stored); err != nil {
		return fmt.Errorf("decode verification code: %w", err)
	}
	if stored.Email != email || subtle.ConstantTimeCompare([]byte(stored.Code), []byte(code)) != 1 {
		return ErrVerificationCodeMismatch
	}
	return nil
}

func (c *Codes) Consume(ctx context.Context, id, email string) error {
	_, found, err := c.store.Take(ctx, codeKey(id, email))
	if err != nil {
		return err
	}
	if !found {
		return ErrVerificationCodeNotFound
	}
	return nil
}

func (c *Codes) Verify(ctx context.Context, id, email, code string) error {
	if err := c.Check(ctx, id, email, code); err != nil {
		return err
	}
	return c.Consume(ctx, id, email)
}

func codeKey(id, email string) string {
	return "verification:" + id + ":" + email
}

func newVerificationCode() (string, error) {
	raw := make([]byte, 3)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate verification code: %w", err)
	}
	return strings.ToUpper(hex.EncodeToString(raw)), nil
}
