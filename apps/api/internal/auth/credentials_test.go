package auth_test

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
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

func TestPasswordLogin(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser(func(u *user.User) { u.Name = "Alice"; u.Email = "alice@example.test" })
	f.seedUser(func(u *user.User) { u.Name = "Banned"; u.Status = user.StatusBanned })
	f.seedUser(func(u *user.User) { u.Name = "Oidc"; u.PasswordHash = nil })

	cases := []struct {
		identifier, password string
		want                 error
	}{
		{"nobody", "Secret123", user.ErrNotFound},
		{"banned", "wrong", user.ErrBanned},
		{"oidc", "Secret123", user.ErrInvalidPassword},
		{"alice", "wrong", user.ErrInvalidPassword},
	}
	for _, tc := range cases {
		if _, err := f.login.Login(ctx, tc.identifier, tc.password, auth.Device{}); !errors.Is(err, tc.want) {
			t.Fatalf("%s: got %v want %v", tc.identifier, err, tc.want)
		}
	}
	tokens, err := f.login.Login(ctx, "ALICE@example.test", "Secret123", auth.Device{IP: "198.51.100.9"})
	if err != nil {
		t.Fatal(err)
	}
	if tokens.SessionID == 0 || tokens.AccessToken == "" {
		t.Fatalf("login must issue a session: %+v", tokens)
	}
	if at, ok := f.users.LastLogin(alice.ID); !ok || !at.Equal(f.clock.Now()) {
		t.Fatalf("last login not recorded: %v %v", at, ok)
	}
}

func TestPasswordReset(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser(func(u *user.User) { u.Email = "alice@example.test" })
	if err := f.reset.Request(ctx, "ALICE@example.test"); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("lookup is exact: %v", err)
	}
	if err := f.reset.Request(ctx, "alice@example.test"); err != nil {
		t.Fatal(err)
	}
	mail := f.mailer.Last()
	link, err := url.Parse(mail.Body)
	if err != nil || link.Scheme != "https" || link.Host != "shionlib.example" || link.Path != "/user/password/forget" || mail.TTL != 10*time.Minute {
		t.Fatalf("unexpected reset link %s", mail.Body)
	}
	token := link.Query().Get("token")
	if link.Query().Get("email") != "alice@example.test" || token == "" {
		t.Fatalf("unexpected link params %s", link.RawQuery)
	}
	if ok, _ := f.reset.Check(ctx, token, "other@example.test"); ok {
		t.Fatal("token is bound to the email")
	}
	if ok, _ := f.reset.Check(ctx, token, "alice@example.test"); !ok {
		t.Fatal("valid token rejected")
	}
	issued, _ := f.sessions.Issue(ctx, auth.PrincipalOf(alice), auth.Device{})
	if err := f.reset.Reset(ctx, token, "alice@example.test", "NewSecret1"); err != nil {
		t.Fatal(err)
	}
	if got := f.users.User(alice.ID); got.PasswordHash == nil || *got.PasswordHash != "hash:NewSecret1" {
		t.Fatalf("password not changed: %+v", got.PasswordHash)
	}
	if session, reason, _ := f.repo.Session(issued.SessionID); session.Status != auth.SessionBlocked || reason != "user_password_changed" {
		t.Fatalf("sessions must be blocked: %+v %s", session, reason)
	}
	if _, blocked := f.families.TTL(issued.FamilyID); !blocked {
		t.Fatal("password reset must block live families")
	}
	if err := f.reset.Reset(ctx, token, "alice@example.test", "Again1234"); !errors.Is(err, auth.ErrInvalidResetPasswordToken) {
		t.Fatalf("tokens are single-use: %v", err)
	}
}
