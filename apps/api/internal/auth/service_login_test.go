package auth_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

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
