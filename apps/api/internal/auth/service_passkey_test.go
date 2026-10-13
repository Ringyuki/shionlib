package auth_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth/authtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func actorOf(u user.User) actor.Actor {
	return actor.Actor{UserID: u.ID, Role: u.Role, ContentLimit: u.ContentLimit}
}

func TestPasskeyRegistration(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	bob := f.seedUser()
	f.repo.SeedPasskey(auth.Passkey{UserID: alice.ID, CredentialID: "existing"})
	f.ceremony.Registered = auth.RegisteredPasskey{CredentialID: "fresh", PublicKey: "pk", Counter: 0, Transports: []string{"internal"}, DeviceType: "multiDevice", BackedUp: true}

	flow, err := f.passkeys.RegisterOptions(ctx, actorOf(alice), ptr("  Laptop  "))
	if err != nil {
		t.Fatal(err)
	}
	var options map[string]any
	if err := json.Unmarshal(flow.Options, &options); err != nil || options["exclude"].([]any)[0] != "existing" {
		t.Fatalf("existing credentials must be excluded: %s", flow.Options)
	}
	if _, err := f.passkeys.RegisterVerify(ctx, actorOf(bob), flow.FlowID, json.RawMessage(`{}`), nil); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("another user cannot finish the flow: %v", err)
	}
	if _, err := f.passkeys.RegisterVerify(ctx, actorOf(alice), flow.FlowID, json.RawMessage(`{}`), nil); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("challenges are single-use: %v", err)
	}

	flow, _ = f.passkeys.RegisterOptions(ctx, actorOf(alice), ptr("  Laptop  "))
	created, err := f.passkeys.RegisterVerify(ctx, actorOf(alice), flow.FlowID, json.RawMessage(`{}`), nil)
	if err != nil {
		t.Fatal(err)
	}
	if created.CredentialID != "fresh" || created.Name == nil || *created.Name != "Laptop" || created.UserID != alice.ID {
		t.Fatalf("unexpected passkey %+v", created)
	}
	if !f.users.User(alice.ID).TwoFactorEnabled {
		t.Fatal("registration enables the two factor flag")
	}
	flow, _ = f.passkeys.RegisterOptions(ctx, actorOf(alice), nil)
	if _, err := f.passkeys.RegisterVerify(ctx, actorOf(alice), flow.FlowID, json.RawMessage(`{}`), nil); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("duplicate credentials are rejected as unauthorized: %v", err)
	}
	f.ceremony.FailFinish = true
	flow, _ = f.passkeys.RegisterOptions(ctx, actorOf(alice), nil)
	if _, err := f.passkeys.RegisterVerify(ctx, actorOf(alice), flow.FlowID, json.RawMessage(`{}`), nil); !errors.Is(err, auth.ErrUnauthorized) {
		t.Fatalf("failed verification: %v", err)
	}

	banned := f.seedUser(func(u *user.User) { u.Status = user.StatusBanned })
	if _, err := f.passkeys.RegisterOptions(ctx, actorOf(banned), nil); !errors.Is(err, user.ErrBanned) {
		t.Fatalf("banned user: %v", err)
	}
	if _, err := f.passkeys.RegisterOptions(ctx, actor.Actor{UserID: 999}, nil); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("missing user: %v", err)
	}
}

func TestPasskeyLogin(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser(func(u *user.User) { u.Name = "Alice" })
	bob := f.seedUser(func(u *user.User) { u.Name = "Bob" })
	f.seedUser(func(u *user.User) { u.Name = "Banned"; u.Status = user.StatusBanned })
	key := f.repo.SeedPasskey(auth.Passkey{UserID: alice.ID, CredentialID: "alice-key", Counter: 1})
	f.repo.SeedPasskey(auth.Passkey{UserID: bob.ID, CredentialID: "bob-key"})

	if _, err := f.passkeys.LoginOptions(ctx, "nobody"); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("unknown identifier: %v", err)
	}
	if _, err := f.passkeys.LoginOptions(ctx, "banned"); !errors.Is(err, user.ErrBanned) {
		t.Fatalf("banned identifier: %v", err)
	}
	if _, err := f.passkeys.LoginVerify(ctx, "missing-flow", authtest.Assertion("alice-key", 2, true), auth.Device{}); !errors.Is(err, auth.ErrForbidden) {
		t.Fatalf("unknown flow: %v", err)
	}

	scoped, err := f.passkeys.LoginOptions(ctx, " alice ")
	if err != nil {
		t.Fatal(err)
	}
	if string(scoped.Options) != `{"allow":["alice-key"]}` {
		t.Fatalf("identifier flow must list the user's credentials: %s", scoped.Options)
	}
	if _, err := f.passkeys.LoginVerify(ctx, scoped.FlowID, authtest.Assertion("bob-key", 2, true), auth.Device{}); !errors.Is(err, auth.ErrForbidden) {
		t.Fatalf("credential of another user: %v", err)
	}

	discoverable, err := f.passkeys.LoginOptions(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.passkeys.LoginVerify(ctx, discoverable.FlowID, authtest.Assertion("alice-key", 2, false), auth.Device{}); !errors.Is(err, auth.ErrForbidden) {
		t.Fatalf("failed assertion: %v", err)
	}
	discoverable, _ = f.passkeys.LoginOptions(ctx, "")
	f.clock.Advance(time.Minute)
	tokens, err := f.passkeys.LoginVerify(ctx, discoverable.FlowID, authtest.Assertion("alice-key", 7, true), auth.Device{})
	if err != nil {
		t.Fatal(err)
	}
	if tokens.SessionID == 0 {
		t.Fatalf("login must issue a session: %+v", tokens)
	}
	used, _ := f.repo.Passkey(key.ID)
	if used.Counter != 7 || used.LastUsedAt == nil || !used.LastUsedAt.Equal(f.clock.Now()) || used.DeviceType == nil || *used.DeviceType != "multiDevice" {
		t.Fatalf("credential use not recorded: %+v", used)
	}
	if at, ok := f.users.LastLogin(alice.ID); !ok || !at.Equal(f.clock.Now()) {
		t.Fatal("last login not recorded")
	}
}

func TestPasskeyListAndRevoke(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice := f.seedUser()
	bob := f.seedUser()
	old := f.clock.Now()
	used := f.repo.SeedPasskey(auth.Passkey{UserID: alice.ID, CredentialID: "used", LastUsedAt: &old})
	f.clock.Advance(time.Minute)
	unused := f.repo.SeedPasskey(auth.Passkey{UserID: alice.ID, CredentialID: "unused"})
	enabled := true
	_ = f.users.Update(ctx, alice.ID, user.Changes{TwoFactorEnabled: &enabled})

	keys, err := f.passkeys.List(ctx, actorOf(alice))
	if err != nil || len(keys) != 2 || keys[0].ID != unused.ID || keys[1].ID != used.ID {
		t.Fatalf("never used keys come first: %+v %v", keys, err)
	}
	if err := f.passkeys.Revoke(ctx, actorOf(bob), used.ID); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("foreign key: %v", err)
	}
	if err := f.passkeys.Revoke(ctx, actorOf(alice), used.ID); err != nil {
		t.Fatal(err)
	}
	if !f.users.User(alice.ID).TwoFactorEnabled {
		t.Fatal("two factor stays enabled while passkeys remain")
	}
	if err := f.passkeys.Revoke(ctx, actorOf(alice), used.ID); !errors.Is(err, user.ErrNotFound) {
		t.Fatalf("already revoked: %v", err)
	}
	if err := f.passkeys.Revoke(ctx, actorOf(alice), unused.ID); err != nil {
		t.Fatal(err)
	}
	if f.users.User(alice.ID).TwoFactorEnabled {
		t.Fatal("revoking the last passkey disables two factor")
	}
}
