package authtest

import (
	"bytes"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
)

type Store interface {
	auth.VerificationCodeStore
	auth.PasswordResetStore
	auth.PasskeyChallengeStore
	auth.RefreshReplayStore
}

func StoreContract(t *testing.T, newStore func(t *testing.T) Store) {
	created := time.Date(2026, 10, 3, 1, 2, 3, 456000000, time.UTC)

	t.Run("verification codes are matched by id and email and taken once", func(t *testing.T) {
		store := newStore(t)
		code := auth.VerificationCode{Email: "a@example.test", Code: "ABC123", Created: created}
		if err := store.SaveVerificationCode(t.Context(), "flow", code, time.Minute); err != nil {
			t.Fatal(err)
		}
		found, ok, err := store.FindVerificationCode(t.Context(), "flow", "a@example.test")
		if err != nil || !ok || found.Code != code.Code || found.Email != code.Email || !found.Created.Equal(created) {
			t.Fatalf("find: %+v %v %v", found, ok, err)
		}
		if _, ok, err := store.FindVerificationCode(t.Context(), "flow", "b@example.test"); err != nil || ok {
			t.Fatalf("another email must not match: %v %v", ok, err)
		}
		if _, ok, err := store.TakeVerificationCode(t.Context(), "flow", "a@example.test"); err != nil || !ok {
			t.Fatalf("take: %v %v", ok, err)
		}
		if _, ok, err := store.TakeVerificationCode(t.Context(), "flow", "a@example.test"); err != nil || ok {
			t.Fatalf("second take: %v %v", ok, err)
		}
	})

	t.Run("concurrent takes hand a verification code to one caller", func(t *testing.T) {
		store := newStore(t)
		if err := store.SaveVerificationCode(t.Context(), "race", auth.VerificationCode{Email: "a@example.test", Code: "X", Created: created}, time.Minute); err != nil {
			t.Fatal(err)
		}
		var taken atomic.Int32
		var wg sync.WaitGroup
		for range 8 {
			wg.Go(func() {
				if _, ok, err := store.TakeVerificationCode(t.Context(), "race", "a@example.test"); err == nil && ok {
					taken.Add(1)
				}
			})
		}
		wg.Wait()
		if taken.Load() != 1 {
			t.Fatalf("exactly one caller may take the code, got %d", taken.Load())
		}
	})

	t.Run("password resets are found until taken", func(t *testing.T) {
		store := newStore(t)
		reset := auth.PasswordReset{Token: "token", Email: "a@example.test"}
		if err := store.SavePasswordReset(t.Context(), reset, time.Minute); err != nil {
			t.Fatal(err)
		}
		if found, ok, err := store.FindPasswordReset(t.Context(), "token", "a@example.test"); err != nil || !ok || found != reset {
			t.Fatalf("find: %+v %v %v", found, ok, err)
		}
		if _, ok, err := store.FindPasswordReset(t.Context(), "other", "a@example.test"); err != nil || ok {
			t.Fatalf("another token must not match: %v %v", ok, err)
		}
		if found, ok, err := store.TakePasswordReset(t.Context(), "token", "a@example.test"); err != nil || !ok || found != reset {
			t.Fatalf("take: %+v %v %v", found, ok, err)
		}
		if _, ok, err := store.FindPasswordReset(t.Context(), "token", "a@example.test"); err != nil || ok {
			t.Fatalf("taken reset is gone: %v %v", ok, err)
		}
	})

	t.Run("passkey challenges are single use", func(t *testing.T) {
		store := newStore(t)
		challenge := auth.PendingPasskeyChallenge{Kind: "register", State: []byte{1, 2, 3}, UserID: 7, SuggestedName: "laptop"}
		if err := store.SavePasskeyChallenge(t.Context(), "flow", challenge, time.Minute); err != nil {
			t.Fatal(err)
		}
		found, ok, err := store.TakePasskeyChallenge(t.Context(), "flow")
		if err != nil || !ok || found.Kind != challenge.Kind || !bytes.Equal(found.State, challenge.State) || found.UserID != 7 || found.SuggestedName != "laptop" {
			t.Fatalf("take: %+v %v %v", found, ok, err)
		}
		if _, ok, err := store.TakePasskeyChallenge(t.Context(), "flow"); err != nil || ok {
			t.Fatalf("second take: %v %v", ok, err)
		}
	})

	t.Run("refresh replays stay readable for the grace period", func(t *testing.T) {
		store := newStore(t)
		tokens := auth.Tokens{AccessToken: "a", AccessExpiresAt: created, RefreshToken: "r", RefreshExpiresAt: created.Add(time.Hour), SessionID: 9, FamilyID: "fam"}
		if err := store.SaveRefreshReplay(t.Context(), 3, tokens, time.Minute); err != nil {
			t.Fatal(err)
		}
		for range 2 {
			found, ok, err := store.FindRefreshReplay(t.Context(), 3)
			if err != nil || !ok || found.AccessToken != "a" || !found.AccessExpiresAt.Equal(created) || found.RefreshToken != "r" || !found.RefreshExpiresAt.Equal(tokens.RefreshExpiresAt) || found.SessionID != 9 || found.FamilyID != "fam" {
				t.Fatalf("find: %+v %v %v", found, ok, err)
			}
		}
		if _, ok, err := store.FindRefreshReplay(t.Context(), 4); err != nil || ok {
			t.Fatalf("another session: %v %v", ok, err)
		}
	})
}
