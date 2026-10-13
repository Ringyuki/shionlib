package authtest

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type Repository interface {
	auth.SessionRepository
	auth.PasskeyRepository
	auth.IdentityRepository
}

type Env struct {
	Repo    Repository
	NewUser func(t *testing.T) int
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Millisecond)
	ip := "203.0.113.7"

	newSession := func(t *testing.T, env Env, userID int, family, prefix string, expires time.Time) auth.Session {
		t.Helper()
		session, err := env.Repo.CreateSession(ctx, auth.NewSession{UserID: userID, RefreshHash: "hash-" + prefix, Prefix: prefix, FamilyID: family, ExpiresAt: expires, LastUsedAt: now, IP: &ip})
		if err != nil {
			t.Fatal(err)
		}
		return session
	}
	status := func(t *testing.T, env Env, prefix string) auth.SessionStatus {
		t.Helper()
		session, found, err := env.Repo.FindSessionByPrefix(ctx, prefix)
		if err != nil || !found {
			t.Fatalf("find %s: %v %v", prefix, found, err)
		}
		return session.Status
	}

	t.Run("sessions are created active and found by prefix", func(t *testing.T) {
		env := newEnv(t)
		userID := env.NewUser(t)
		family := "11111111-1111-4111-8111-111111111111"
		created := newSession(t, env, userID, family, "prefix-a", now.Add(time.Hour))
		if created.ID == 0 || created.Status != auth.SessionActive || created.FamilyID != family || created.UserID != userID {
			t.Fatalf("unexpected session %+v", created)
		}
		locked, found, err := env.Repo.LockSessionByPrefix(ctx, "prefix-a")
		if err != nil || !found || locked.ID != created.ID || locked.RefreshHash != "hash-prefix-a" || !locked.ExpiresAt.Equal(now.Add(time.Hour)) {
			t.Fatalf("lock: %+v %v %v", locked, found, err)
		}
		if _, found, err := env.Repo.FindSessionByPrefix(ctx, "missing"); err != nil || found {
			t.Fatalf("missing prefix: %v %v", found, err)
		}
		if _, found, err := env.Repo.LockSessionByPrefix(ctx, "missing"); err != nil || found {
			t.Fatalf("missing prefix lock: %v %v", found, err)
		}
		started, found, err := env.Repo.FamilyStartedAt(ctx, family)
		if err != nil || !found || started.IsZero() {
			t.Fatalf("family start: %v %v %v", started, found, err)
		}
		if _, found, err := env.Repo.FamilyStartedAt(ctx, "22222222-2222-4222-8222-222222222222"); err != nil || found {
			t.Fatalf("unknown family: %v %v", found, err)
		}
	})

	t.Run("rotation, reuse and family blocks only touch the requested statuses", func(t *testing.T) {
		env := newEnv(t)
		userID := env.NewUser(t)
		family := "33333333-3333-4333-8333-333333333333"
		old := newSession(t, env, userID, family, "rot-old", now.Add(time.Hour))
		newer := newSession(t, env, userID, family, "rot-new", now.Add(time.Hour))
		if err := env.Repo.MarkSessionRotated(ctx, old.ID, newer.ID, now); err != nil {
			t.Fatal(err)
		}
		if got := status(t, env, "rot-old"); got != auth.SessionRotated {
			t.Fatalf("rotated status %d", got)
		}
		if err := env.Repo.MarkSessionReused(ctx, old.ID, now); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.BlockFamily(ctx, family, []auth.SessionStatus{auth.SessionActive}, "refresh_token_reuse_detected", now); err != nil {
			t.Fatal(err)
		}
		if got := status(t, env, "rot-old"); got != auth.SessionReused {
			t.Fatalf("reused session must keep its status, got %d", got)
		}
		if got := status(t, env, "rot-new"); got != auth.SessionBlocked {
			t.Fatalf("active session must be blocked, got %d", got)
		}
		other := newSession(t, env, userID, "44444444-4444-4444-8444-444444444444", "rot-other", now.Add(time.Hour))
		if err := env.Repo.BlockUserFamily(ctx, userID, family, "user_logout", now); err != nil {
			t.Fatal(err)
		}
		if got := status(t, env, "rot-old"); got != auth.SessionBlocked {
			t.Fatalf("logout blocks every status of the family, got %d", got)
		}
		if got := status(t, env, other.Prefix); got != auth.SessionActive {
			t.Fatalf("other families stay active, got %d", got)
		}
	})

	t.Run("blocking a user reports live families and blocks every session", func(t *testing.T) {
		env := newEnv(t)
		userID := env.NewUser(t)
		stranger := env.NewUser(t)
		newSession(t, env, userID, "55555555-5555-4555-8555-555555555555", "user-a", now.Add(time.Hour))
		newSession(t, env, userID, "66666666-6666-4666-8666-666666666666", "user-b", now.Add(2*time.Hour))
		rotated := newSession(t, env, userID, "66666666-6666-4666-8666-666666666666", "user-c", now.Add(time.Hour))
		if err := env.Repo.MarkSessionRotated(ctx, rotated.ID, rotated.ID, now); err != nil {
			t.Fatal(err)
		}
		newSession(t, env, stranger, "77777777-7777-4777-8777-777777777777", "stranger", now.Add(time.Hour))
		families, err := env.Repo.BlockUserSessions(ctx, userID, "user_password_changed", now, now.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		if len(families) != 2 || families[0].FamilyID != "55555555-5555-4555-8555-555555555555" || families[1].FamilyID != "66666666-6666-4666-8666-666666666666" {
			t.Fatalf("unexpected live families %+v", families)
		}
		for _, prefix := range []string{"user-a", "user-b", "user-c"} {
			if got := status(t, env, prefix); got != auth.SessionBlocked {
				t.Fatalf("%s status %d", prefix, got)
			}
		}
		if got := status(t, env, "stranger"); got != auth.SessionActive {
			t.Fatalf("other users are untouched, got %d", got)
		}
		later, err := env.Repo.BlockUserSessions(ctx, stranger, "user_banned", now, time.Now().UTC().Add(time.Hour))
		if err != nil || len(later) != 0 {
			t.Fatalf("sessions older than the live window are not reported: %+v %v", later, err)
		}
	})

	t.Run("stale cleanup keeps active sessions", func(t *testing.T) {
		env := newEnv(t)
		userID := env.NewUser(t)
		expired := now.Add(-30 * 24 * time.Hour)
		newSession(t, env, userID, "88888888-8888-4888-8888-888888888888", "stale-active", expired)
		blocked := newSession(t, env, userID, "99999999-9999-4999-8999-999999999999", "stale-blocked", expired)
		newSession(t, env, userID, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "fresh-blocked", now.Add(time.Hour))
		if err := env.Repo.BlockFamily(ctx, blocked.FamilyID, []auth.SessionStatus{auth.SessionActive}, "user_logout", now); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.BlockFamily(ctx, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", []auth.SessionStatus{auth.SessionActive}, "user_logout", now); err != nil {
			t.Fatal(err)
		}
		deleted, err := env.Repo.DeleteStaleSessions(ctx, now.Add(-7*24*time.Hour))
		if err != nil || deleted != 1 {
			t.Fatalf("deleted %d %v", deleted, err)
		}
		if _, found, _ := env.Repo.FindSessionByPrefix(ctx, "stale-blocked"); found {
			t.Fatal("stale blocked session survived")
		}
		for _, prefix := range []string{"stale-active", "fresh-blocked"} {
			if _, found, _ := env.Repo.FindSessionByPrefix(ctx, prefix); !found {
				t.Fatalf("%s must be kept", prefix)
			}
		}
	})

	t.Run("passkeys are unique, revocable and ordered by creation", func(t *testing.T) {
		env := newEnv(t)
		owner := env.NewUser(t)
		other := env.NewUser(t)
		name := "laptop"
		aaguid := "00000000-0000-0000-0000-000000000000"
		first, err := env.Repo.CreatePasskey(ctx, auth.NewPasskey{UserID: owner, CredentialID: "cred-1", PublicKey: "pk-1", Counter: 3, Transports: []string{"internal", "hybrid"}, AAGUID: &aaguid, DeviceType: "multiDevice", BackedUp: true, Name: &name, LastUsedAt: now})
		if err != nil {
			t.Fatal(err)
		}
		if first.ID == 0 || first.CredentialID != "cred-1" || first.Counter != 3 || len(first.Transports) != 2 || first.DeviceType == nil || *first.DeviceType != "multiDevice" || !first.BackedUp || first.Name == nil || *first.Name != "laptop" || first.AAGUID == nil {
			t.Fatalf("unexpected passkey %+v", first)
		}
		if _, err := env.Repo.CreatePasskey(ctx, auth.NewPasskey{UserID: other, CredentialID: "cred-1", PublicKey: "pk", DeviceType: "singleDevice", LastUsedAt: now}); !errors.Is(err, auth.ErrPasskeyExists) {
			t.Fatalf("duplicate credential: %v", err)
		}
		second, err := env.Repo.CreatePasskey(ctx, auth.NewPasskey{UserID: owner, CredentialID: "cred-2", PublicKey: "pk-2", DeviceType: "singleDevice", LastUsedAt: now})
		if err != nil {
			t.Fatal(err)
		}
		if len(second.Transports) != 0 || second.Transports == nil {
			t.Fatalf("missing transports must be an empty list: %+v", second.Transports)
		}
		keys, err := env.Repo.ActivePasskeys(ctx, owner)
		if err != nil || len(keys) != 2 || keys[0].ID != first.ID || keys[1].ID != second.ID {
			t.Fatalf("active passkeys: %+v %v", keys, err)
		}
		at := now.Add(time.Minute)
		if err := env.Repo.RecordPasskeyUse(ctx, first.ID, auth.PasskeyUse{Counter: 9, DeviceType: "singleDevice", BackedUp: false, At: at}); err != nil {
			t.Fatal(err)
		}
		found, ok, err := env.Repo.FindActivePasskey(ctx, "cred-1")
		if err != nil || !ok || found.Counter != 9 || *found.DeviceType != "singleDevice" || found.BackedUp || found.LastUsedAt == nil || !found.LastUsedAt.Equal(at) {
			t.Fatalf("passkey after use: %+v %v %v", found, ok, err)
		}
		if revoked, err := env.Repo.RevokePasskey(ctx, first.ID, other, now); err != nil || revoked {
			t.Fatalf("foreign revoke: %v %v", revoked, err)
		}
		if revoked, err := env.Repo.RevokePasskey(ctx, first.ID, owner, now); err != nil || !revoked {
			t.Fatalf("revoke: %v %v", revoked, err)
		}
		if revoked, err := env.Repo.RevokePasskey(ctx, first.ID, owner, now); err != nil || revoked {
			t.Fatalf("second revoke: %v %v", revoked, err)
		}
		if _, ok, _ := env.Repo.FindActivePasskey(ctx, "cred-1"); ok {
			t.Fatal("revoked passkey is still active")
		}
		if count, err := env.Repo.CountActivePasskeys(ctx, owner); err != nil || count != 1 {
			t.Fatalf("count: %d %v", count, err)
		}
	})

	t.Run("identities are unique per provider subject", func(t *testing.T) {
		env := newEnv(t)
		owner := env.NewUser(t)
		email := "owner@example.test"
		for i := range 2 {
			if err := env.Repo.CreateIdentity(ctx, auth.NewIdentity{UserID: owner, Provider: auth.OIDCProvider, Subject: "sub-" + strconv.Itoa(i), EmailAtLink: &email, LastLoginAt: now}); err != nil {
				t.Fatal(err)
			}
		}
		if err := env.Repo.CreateIdentity(ctx, auth.NewIdentity{UserID: env.NewUser(t), Provider: auth.OIDCProvider, Subject: "sub-0", LastLoginAt: now}); !errors.Is(err, auth.ErrIdentityExists) {
			t.Fatalf("duplicate subject: %v", err)
		}
		found, ok, err := env.Repo.FindIdentity(ctx, auth.OIDCProvider, "sub-1")
		if err != nil || !ok || found.UserID != owner || found.EmailAtLink == nil || *found.EmailAtLink != email {
			t.Fatalf("find identity: %+v %v %v", found, ok, err)
		}
		if _, ok, _ := env.Repo.FindIdentity(ctx, "other", "sub-1"); ok {
			t.Fatal("provider is part of the key")
		}
		at := now.Add(time.Hour)
		if err := env.Repo.TouchIdentity(ctx, found.ID, at); err != nil {
			t.Fatal(err)
		}
		got, ok, err := env.Repo.GetIdentity(ctx, found.ID)
		if err != nil || !ok || got.LastLoginAt == nil || !got.LastLoginAt.Equal(at) {
			t.Fatalf("touched identity: %+v %v %v", got, ok, err)
		}
		items, err := env.Repo.ListIdentities(ctx, owner)
		if err != nil || len(items) != 2 || items[0].Subject != "sub-0" {
			t.Fatalf("list: %+v %v", items, err)
		}
		if err := env.Repo.DeleteIdentity(ctx, items[0].ID); err != nil {
			t.Fatal(err)
		}
		if count, err := env.Repo.CountIdentities(ctx, owner); err != nil || count != 1 {
			t.Fatalf("count: %d %v", count, err)
		}
		if _, ok, err := env.Repo.GetIdentity(ctx, items[0].ID); err != nil || ok {
			t.Fatalf("deleted identity: %v %v", ok, err)
		}
	})
}
