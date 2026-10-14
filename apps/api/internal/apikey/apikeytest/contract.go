package apikeytest

import (
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
)

type Env struct {
	Repo    apikey.Repository
	NewUser func(t *testing.T, banned bool) int
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	t.Run("keys belong to their owner and are found by the hash of their secret", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		owner, other := env.NewUser(t, false), env.NewUser(t, false)
		first, err := env.Repo.Create(ctx, apikey.NewKey{UserID: owner, Name: "first", Prefix: "shl_aaaaaaaa", SecretHash: "hash-first"})
		if err != nil {
			t.Fatal(err)
		}
		second, err := env.Repo.Create(ctx, apikey.NewKey{UserID: owner, Name: "second", Prefix: "shl_bbbbbbbb", SecretHash: "hash-second"})
		if err != nil {
			t.Fatal(err)
		}
		if first.Status != apikey.StatusActive || first.Prefix != "shl_aaaaaaaa" || first.UserID != owner {
			t.Fatalf("unexpected key %+v", first)
		}
		mine, err := env.Repo.Mine(ctx, owner)
		if err != nil || len(mine) != 2 || mine[0].ID != second.ID {
			t.Fatalf("the newest key first: %+v %v", mine, err)
		}
		if count, err := env.Repo.CountMine(ctx, other); err != nil || count != 0 {
			t.Fatalf("another account has none: %d %v", count, err)
		}
		found, err := env.Repo.BySecretHash(ctx, "hash-second")
		if err != nil || found.ID != second.ID {
			t.Fatalf("found by hash: %+v %v", found, err)
		}
		if _, err := env.Repo.BySecretHash(ctx, "unknown"); !errors.Is(err, apikey.ErrNotFound) {
			t.Fatalf("an unknown hash: %v", err)
		}
		if err := env.Repo.DeleteMine(ctx, other, first.ID); !errors.Is(err, apikey.ErrNotFound) {
			t.Fatalf("nobody deletes another account's key: %v", err)
		}
		if err := env.Repo.DeleteMine(ctx, owner, first.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, first.ID); !errors.Is(err, apikey.ErrNotFound) {
			t.Fatalf("deleted: %v", err)
		}
	})

	t.Run("owners carry their standing and their own limit", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		member, banned := env.NewUser(t, false), env.NewUser(t, true)
		if owner, err := env.Repo.Owner(ctx, banned); err != nil || !owner.Banned {
			t.Fatalf("banned owner: %+v %v", owner, err)
		}
		limit := 300
		if err := env.Repo.SetAccountLimit(ctx, member, &limit); err != nil {
			t.Fatal(err)
		}
		if owner, err := env.Repo.Owner(ctx, member); err != nil || owner.Banned || owner.Limit == nil || *owner.Limit != 300 {
			t.Fatalf("own limit: %+v %v", owner, err)
		}
		if err := env.Repo.SetAccountLimit(ctx, member, nil); err != nil {
			t.Fatal(err)
		}
		if owner, err := env.Repo.Owner(ctx, member); err != nil || owner.Limit != nil {
			t.Fatalf("the site's limit again: %+v %v", owner, err)
		}
	})

	t.Run("keys are touched, suspended and restored", func(t *testing.T) {
		env := newEnv(t)
		ctx := t.Context()
		owner, admin := env.NewUser(t, false), env.NewUser(t, false)
		key, err := env.Repo.Create(ctx, apikey.NewKey{UserID: owner, Name: "k", Prefix: "shl_cccccccc", SecretHash: "hash-touch"})
		if err != nil {
			t.Fatal(err)
		}
		at := time.Date(2026, 10, 14, 3, 0, 0, 0, time.UTC)
		if err := env.Repo.Touch(ctx, key.ID, at, "203.0.113.24"); err != nil {
			t.Fatal(err)
		}
		reason := "too many requests"
		if err := env.Repo.SetSuspended(ctx, key.ID, &reason, &at, &admin); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, key.ID)
		if err != nil || !got.Suspended() || got.SuspendedReason == nil || *got.SuspendedReason != reason || got.LastUsedIP == nil || *got.LastUsedIP != "203.0.113.24" || got.LastUsedAt == nil || !got.LastUsedAt.Equal(at) {
			t.Fatalf("suspended and touched: %+v %v", got, err)
		}
		if err := env.Repo.SetSuspended(ctx, key.ID, nil, nil, nil); err != nil {
			t.Fatal(err)
		}
		if got, err := env.Repo.Get(ctx, key.ID); err != nil || got.Suspended() || got.SuspendedReason != nil || got.SuspendedAt != nil {
			t.Fatalf("restored: %+v %v", got, err)
		}
		if err := env.Repo.SetSuspended(ctx, 987654, nil, nil, nil); !errors.Is(err, apikey.ErrNotFound) {
			t.Fatalf("a missing key: %v", err)
		}
	})
}
