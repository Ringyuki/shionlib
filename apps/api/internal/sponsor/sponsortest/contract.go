package sponsortest

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

type Env struct {
	Repo         sponsor.Repository
	NewUser      func(t *testing.T) int
	SponsorUntil func(t *testing.T, userID int) *time.Time
}

var providerSequence atomic.Int64

func newOrder(userID *int, cents int64, private bool) sponsor.NewOrder {
	name, message := "Alice", "Thanks!"
	return sponsor.NewOrder{
		ProviderOrderID: fmt.Sprintf("contract-%d", providerSequence.Add(1)),
		Provider:        "idatariver",
		AmountCents:     cents,
		SponsorName:     &name,
		Message:         &message,
		IsPrivate:       private,
		UserID:          userID,
		ExpiresAt:       time.Date(2030, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("create then read by id and provider id with the owner summary", func(t *testing.T) {
		env := newEnv(t)
		owner := env.NewUser(t)
		created, err := env.Repo.Create(ctx, newOrder(&owner, 1050, false))
		if err != nil {
			t.Fatal(err)
		}
		if created.ID == 0 || created.Status != sponsor.StatusNew || created.AmountCents != 1050 || created.ExpiresAt == nil || created.PaidAt != nil {
			t.Fatalf("unexpected created order %+v", created)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.User == nil || got.User.ID != owner || got.SponsorName == nil || *got.SponsorName != "Alice" || got.Provider != "idatariver" {
			t.Fatalf("unexpected order %+v", got)
		}
		byProvider, err := env.Repo.FindByProviderOrderID(ctx, created.ProviderOrderID)
		if err != nil || byProvider.ID != created.ID {
			t.Fatalf("find by provider id: %+v %v", byProvider, err)
		}
		locked, err := env.Repo.Lock(ctx, created.ID)
		if err != nil || locked.ID != created.ID {
			t.Fatalf("lock: %+v %v", locked, err)
		}
	})

	t.Run("missing orders are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("lock: %v", err)
		}
		if _, err := env.Repo.FindByProviderOrderID(ctx, "missing"); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("find: %v", err)
		}
		if err := env.Repo.SetPaymentMethod(ctx, 987654, "alipay"); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("set payment method: %v", err)
		}
		if err := env.Repo.ApplyStatus(ctx, 987654, sponsor.StatusChange{Status: sponsor.StatusDone}); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("apply status: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("delete: %v", err)
		}
	})

	t.Run("anonymous orders have no user", func(t *testing.T) {
		env := newEnv(t)
		created, err := env.Repo.Create(ctx, newOrder(nil, 500, true))
		if err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, created.ID)
		if got.UserID != nil || got.User != nil || !got.IsPrivate {
			t.Fatalf("unexpected anonymous order %+v", got)
		}
	})

	t.Run("status changes keep callback verification sticky", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.Create(ctx, newOrder(nil, 500, false))
		paid := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
		if err := env.Repo.ApplyStatus(ctx, created.ID, sponsor.StatusChange{Status: sponsor.StatusDone, PaidAt: &paid, CallbackVerified: true}); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.SetPaymentMethod(ctx, created.ID, "wxpay"); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.ApplyStatus(ctx, created.ID, sponsor.StatusChange{Status: sponsor.StatusRefund}); err != nil {
			t.Fatal(err)
		}
		got, _ := env.Repo.Get(ctx, created.ID)
		if got.Status != sponsor.StatusRefund || got.PaidAt == nil || !got.PaidAt.Equal(paid) || !got.CallbackVerified || got.PaymentMethod == nil || *got.PaymentMethod != "wxpay" {
			t.Fatalf("unexpected order after status changes %+v", got)
		}
	})

	t.Run("list filters by status newest first", func(t *testing.T) {
		env := newEnv(t)
		first, _ := env.Repo.Create(ctx, newOrder(nil, 100, false))
		second, _ := env.Repo.Create(ctx, newOrder(nil, 200, false))
		third, _ := env.Repo.Create(ctx, newOrder(nil, 300, false))
		_ = env.Repo.ApplyStatus(ctx, second.ID, sponsor.StatusChange{Status: sponsor.StatusDone})
		all, total, err := env.Repo.List(ctx, sponsor.ListFilter{}, sponsor.Page{Number: 1, Size: 2})
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || len(all) != 2 || all[0].ID != third.ID || all[1].ID != second.ID {
			t.Fatalf("unexpected listing %d %+v", total, all)
		}
		rest, _, _ := env.Repo.List(ctx, sponsor.ListFilter{}, sponsor.Page{Number: 2, Size: 2})
		if len(rest) != 1 || rest[0].ID != first.ID {
			t.Fatalf("unexpected second page %+v", rest)
		}
		done := sponsor.StatusDone
		filtered, total, _ := env.Repo.List(ctx, sponsor.ListFilter{Status: &done}, sponsor.Page{Number: 1, Size: 10})
		if total != 1 || len(filtered) != 1 || filtered[0].ID != second.ID {
			t.Fatalf("unexpected filtered listing %d %+v", total, filtered)
		}
	})

	t.Run("wall shows public paid orders by payment time and stats sum paid orders", func(t *testing.T) {
		env := newEnv(t)
		owner := env.NewUser(t)
		early, _ := env.Repo.Create(ctx, newOrder(&owner, 1000, false))
		late, _ := env.Repo.Create(ctx, newOrder(nil, 1234, false))
		hidden, _ := env.Repo.Create(ctx, newOrder(nil, 500, true))
		_, _ = env.Repo.Create(ctx, newOrder(nil, 700, false))
		at := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
		for i, id := range []int{early.ID, late.ID, hidden.ID} {
			paid := at.Add(time.Duration(i) * time.Hour)
			if err := env.Repo.ApplyStatus(ctx, id, sponsor.StatusChange{Status: sponsor.StatusDone, PaidAt: &paid}); err != nil {
				t.Fatal(err)
			}
		}
		entries, total, err := env.Repo.Wall(ctx, sponsor.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != 2 || len(entries) != 2 || entries[0].ID != late.ID || entries[1].ID != early.ID {
			t.Fatalf("unexpected wall %d %+v", total, entries)
		}
		if entries[1].User == nil || entries[1].User.ID != owner || entries[1].AmountCents != 1000 || !entries[1].PaidAt.Equal(at) {
			t.Fatalf("unexpected wall entry %+v", entries[1])
		}
		stats, err := env.Repo.Stats(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if stats.TotalSponsors != 3 || stats.TotalAmountCents != 2734 {
			t.Fatalf("unexpected stats %+v", stats)
		}
	})

	t.Run("expire stale only touches new orders past their expiry", func(t *testing.T) {
		env := newEnv(t)
		stale := newOrder(nil, 100, false)
		stale.ExpiresAt = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		staleOrder, _ := env.Repo.Create(ctx, stale)
		fresh, _ := env.Repo.Create(ctx, newOrder(nil, 100, false))
		paidStale := newOrder(nil, 100, false)
		paidStale.ExpiresAt = stale.ExpiresAt
		paidOrder, _ := env.Repo.Create(ctx, paidStale)
		_ = env.Repo.ApplyStatus(ctx, paidOrder.ID, sponsor.StatusChange{Status: sponsor.StatusDone})
		count, err := env.Repo.ExpireStale(ctx, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC))
		if err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("expected one expired order, got %d", count)
		}
		for id, want := range map[int]sponsor.Status{staleOrder.ID: sponsor.StatusExpired, fresh.ID: sponsor.StatusNew, paidOrder.ID: sponsor.StatusDone} {
			got, _ := env.Repo.Get(ctx, id)
			if got.Status != want {
				t.Fatalf("order %d: got %s want %s", id, got.Status, want)
			}
		}
	})

	t.Run("sponsorship stacks on an unexpired badge and starts now otherwise", func(t *testing.T) {
		env := newEnv(t)
		member := env.NewUser(t)
		now := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
		if err := env.Repo.ExtendSponsorship(ctx, member, 30*24*time.Hour, now); err != nil {
			t.Fatal(err)
		}
		until := env.SponsorUntil(t, member)
		if until == nil || !until.Equal(now.Add(30*24*time.Hour)) {
			t.Fatalf("first extension: %v", until)
		}
		if err := env.Repo.ExtendSponsorship(ctx, member, 6*24*time.Hour, now.Add(24*time.Hour)); err != nil {
			t.Fatal(err)
		}
		until = env.SponsorUntil(t, member)
		if until == nil || !until.Equal(now.Add(36*24*time.Hour)) {
			t.Fatalf("stacked extension: %v", until)
		}
		later := now.Add(100 * 24 * time.Hour)
		if err := env.Repo.ExtendSponsorship(ctx, member, 24*time.Hour, later); err != nil {
			t.Fatal(err)
		}
		until = env.SponsorUntil(t, member)
		if until == nil || !until.Equal(later.Add(24*time.Hour)) {
			t.Fatalf("expired badge restarts from now: %v", until)
		}
		if err := env.Repo.ExtendSponsorship(ctx, 987654, time.Hour, now); err != nil {
			t.Fatalf("missing users are ignored: %v", err)
		}
	})

	t.Run("delete removes the order", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.Create(ctx, newOrder(nil, 100, false))
		if err := env.Repo.Delete(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, created.ID); !errors.Is(err, sponsor.ErrOrderNotFound) {
			t.Fatalf("deleted order still readable: %v", err)
		}
	})
}
