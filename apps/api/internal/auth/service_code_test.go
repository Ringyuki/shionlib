package auth_test

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

func TestCodesAreSingleUse(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	id, err := f.codes.Request(ctx, "a@example.test", 0)
	if err != nil {
		t.Fatal(err)
	}
	mail := f.mailer.Last()
	if mail.To != "a@example.test" || mail.TTL != 10*time.Minute || !regexp.MustCompile(`^[0-9A-F]{6}$`).MatchString(mail.Body) {
		t.Fatalf("unexpected mail %+v", mail)
	}
	wrong := "000000"
	if mail.Body == wrong {
		wrong = "111111"
	}
	if err := f.codes.Verify(ctx, id, "a@example.test", wrong); !errors.Is(err, auth.ErrVerificationCodeMismatch) {
		t.Fatalf("wrong code: %v", err)
	}
	if err := f.codes.Verify(ctx, id, "b@example.test", mail.Body); !errors.Is(err, auth.ErrVerificationCodeNotFound) {
		t.Fatalf("code is bound to its email: %v", err)
	}
	if err := f.codes.Check(ctx, id, "a@example.test", mail.Body); err != nil {
		t.Fatalf("check does not consume: %v", err)
	}
	if err := f.codes.Verify(ctx, id, "a@example.test", mail.Body); err != nil {
		t.Fatal(err)
	}
	if err := f.codes.Verify(ctx, id, "a@example.test", mail.Body); !errors.Is(err, auth.ErrVerificationCodeNotFound) {
		t.Fatalf("a used code must be rejected: %v", err)
	}
}

func TestCodesExpireAndHonourCustomTTL(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	id, err := f.codes.Request(ctx, "a@example.test", 30*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if mail := f.mailer.Last(); mail.TTL != 30*time.Minute {
		t.Fatalf("mail must state the code lifetime: %v", mail.TTL)
	}
	f.clock.Advance(31 * time.Minute)
	if err := f.codes.Check(ctx, id, "a@example.test", f.mailer.Last().Body); !errors.Is(err, auth.ErrVerificationCodeNotFound) {
		t.Fatalf("expired code: %v", err)
	}
	f.mailer.Fail = errors.New("smtp down")
	if _, err := f.codes.Request(ctx, "a@example.test", 0); err == nil {
		t.Fatal("mail failures must surface")
	}
}
