package auth_test

import (
	"context"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

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
