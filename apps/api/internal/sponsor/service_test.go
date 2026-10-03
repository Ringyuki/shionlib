package sponsor_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor/sponsortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var (
	now      = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	member   = actor.Actor{UserID: 10, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	stranger = actor.Actor{UserID: 11, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	guest    = actor.Guest()
)

type fixture struct {
	repo     *sponsortest.MemoryRepository
	provider *sponsortest.Provider
	cache    *sponsortest.Cache
	service  *sponsor.Service
}

func newFixture(enabled bool) fixture {
	repo := sponsortest.NewMemoryRepository(func() time.Time { return now })
	repo.AddUser(user.Summary{ID: member.UserID, Name: "member"})
	provider := sponsortest.NewProvider()
	cache := sponsortest.NewCache()
	options := sponsor.Options{Enabled: enabled, Provider: "idatariver", CallbackURL: "https://shionlib.test/api/sponsor/webhook/idatariver"}
	service := sponsor.NewService(repo, provider, cache, &txtest.Immediate{}, sponsortest.Signer{}, options, func() time.Time { return now })
	return fixture{repo: repo, provider: provider, cache: cache, service: service}
}

func (f fixture) seed(order sponsor.Order) sponsor.Order {
	if order.ProviderOrderID == "" {
		order.ProviderOrderID = "idr-seed"
	}
	seeded := f.repo.Seed(order)
	f.provider.Put(sponsor.ProviderOrder{ID: seeded.ProviderOrderID, Status: sponsor.StatusNew, AmountCents: seeded.AmountCents})
	return seeded
}

func ptr[T any](v T) *T {
	return &v
}

func TestCentsFromAmount(t *testing.T) {
	cases := map[float64]int64{1: 100, 10.5: 1050, 10.555: 1056, 0.07: 7, 10000: 1000000, 99.994: 9999, 1.005: 101}
	for amount, want := range cases {
		if got := sponsor.CentsFromAmount(amount); got != want {
			t.Errorf("CentsFromAmount(%v) = %d, want %d", amount, got, want)
		}
	}
}

func TestCreateOrder(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	providerExpiry := now.Add(30 * time.Minute)
	f.provider.ExpiresAt = &providerExpiry
	f.provider.Methods = []sponsor.PaymentMethod{{Method: "alipay", Name: "Alipay", Enabled: true}}

	created, err := f.service.CreateOrder(ctx, member, sponsor.CreateOrderInput{AmountCents: 1050, Name: "Alice", Message: ""})
	if err != nil {
		t.Fatal(err)
	}
	if created.ProviderOrderID != "idr-1" || len(created.PaymentMethods) != 1 || created.ExpiresAt == nil || !created.ExpiresAt.Equal(providerExpiry) {
		t.Fatalf("unexpected created order %+v", created)
	}
	if created.AccessToken != "signed:sponsor-order:1:idr-1" {
		t.Fatalf("access token must sign the order identity: %q", created.AccessToken)
	}
	stored, _ := f.repo.Get(ctx, created.OrderID)
	if stored.UserID == nil || *stored.UserID != member.UserID || stored.SponsorName == nil || *stored.SponsorName != "Alice" || stored.Message != nil || stored.Provider != "idatariver" || !stored.ExpiresAt.Equal(providerExpiry) {
		t.Fatalf("unexpected stored order %+v", stored)
	}

	f.provider.ExpiresAt = nil
	anonymous, err := f.service.CreateOrder(ctx, guest, sponsor.CreateOrderInput{AmountCents: 500, IsPrivate: true})
	if err != nil {
		t.Fatal(err)
	}
	stored, _ = f.repo.Get(ctx, anonymous.OrderID)
	if stored.UserID != nil || !stored.IsPrivate || !stored.ExpiresAt.Equal(now.Add(time.Hour)) || anonymous.ExpiresAt != nil {
		t.Fatalf("anonymous order falls back to a one hour local expiry: %+v %+v", stored, anonymous)
	}
}

func TestDisabledModule(t *testing.T) {
	ctx := context.Background()
	f := newFixture(false)
	if _, err := f.service.CreateOrder(ctx, member, sponsor.CreateOrderInput{AmountCents: 100}); !errors.Is(err, sponsor.ErrDisabled) {
		t.Fatalf("create while disabled: %v", err)
	}
	order := f.seed(sponsor.Order{AmountCents: 100})
	if _, err := f.service.PayOrder(ctx, order.ID, sponsor.PayInput{Method: "alipay"}); !errors.Is(err, sponsor.ErrDisabled) {
		t.Fatalf("pay while disabled: %v", err)
	}
	if _, err := f.service.Order(ctx, guest, order.ID, ""); err != nil {
		t.Fatalf("reading an order is not gated: %v", err)
	}
}

func TestPayOrder(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	pending := f.seed(sponsor.Order{ProviderOrderID: "idr-pay", AmountCents: 800})
	paid := f.seed(sponsor.Order{ProviderOrderID: "idr-paid", AmountCents: 800, Status: sponsor.StatusDone})
	expired := f.seed(sponsor.Order{ProviderOrderID: "idr-expired", AmountCents: 800, Status: sponsor.StatusExpired})
	refunded := f.seed(sponsor.Order{ProviderOrderID: "idr-refund", AmountCents: 800, Status: sponsor.StatusRefund})

	payment, err := f.service.PayOrder(ctx, pending.ID, sponsor.PayInput{Method: "alipay", RedirectURL: ptr("https://shionlib.test/done")})
	if err != nil {
		t.Fatal(err)
	}
	if payment.PayURL != "https://pay.example/idr-pay" {
		t.Fatalf("unexpected payment %+v", payment)
	}
	request := f.provider.Payments[0]
	if request.CallbackURL != "https://shionlib.test/api/sponsor/webhook/idatariver" || request.Method != "alipay" || request.RedirectURL == nil {
		t.Fatalf("unexpected provider request %+v", request)
	}
	stored, _ := f.repo.Get(ctx, pending.ID)
	if stored.PaymentMethod == nil || *stored.PaymentMethod != "alipay" {
		t.Fatalf("payment method not stored: %+v", stored)
	}
	if _, err := f.service.PayOrder(ctx, paid.ID, sponsor.PayInput{Method: "alipay"}); !errors.Is(err, sponsor.ErrOrderAlreadyPaid) {
		t.Fatalf("paid order: %v", err)
	}
	if _, err := f.service.PayOrder(ctx, expired.ID, sponsor.PayInput{Method: "alipay"}); !errors.Is(err, sponsor.ErrOrderExpired) {
		t.Fatalf("expired order: %v", err)
	}
	if _, err := f.service.PayOrder(ctx, refunded.ID, sponsor.PayInput{Method: "alipay"}); err != nil {
		t.Fatalf("refunded orders can be paid again: %v", err)
	}
	if _, err := f.service.PayOrder(ctx, 999, sponsor.PayInput{Method: "alipay"}); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
}

func TestOrderStatusSyncsOnlyForOwnerOrTokenHolder(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	owned := f.seed(sponsor.Order{ProviderOrderID: "idr-owned", AmountCents: 1000, UserID: ptr(member.UserID), SponsorName: ptr("Alice"), Message: ptr("hi"), PaymentMethod: ptr("alipay")})
	f.provider.SetStatus("idr-owned", sponsor.StatusDone)
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-owned", Status: sponsor.StatusDone, AmountCents: 1000})

	view, err := f.service.Order(ctx, stranger, owned.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if view.Full || view.Order.Status != sponsor.StatusNew || f.provider.InfoCalls != 0 {
		t.Fatalf("strangers must not trigger a provider sync: %+v calls=%d", view, f.provider.InfoCalls)
	}
	if view.Order.SponsorName != nil || view.Order.Message != nil || view.Order.User != nil || view.Order.PaymentMethod != nil || view.Order.ProviderOrderID != "" {
		t.Fatalf("strangers see a redacted order: %+v", view.Order)
	}
	if _, err := f.service.Order(ctx, stranger, owned.ID, "forged"); err != nil || f.provider.InfoCalls != 0 {
		t.Fatalf("a forged token must not sync: %v calls=%d", err, f.provider.InfoCalls)
	}

	view, err = f.service.Order(ctx, member, owned.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if !view.Full || view.Order.Status != sponsor.StatusDone || view.Order.PaidAt == nil || view.Order.User == nil {
		t.Fatalf("owner sync must move the order to DONE: %+v", view)
	}
	summary, _ := f.repo.User(member.UserID)
	if summary.SponsorExpiresAt == nil || !summary.SponsorExpiresAt.Equal(now.Add(60*24*time.Hour)) {
		t.Fatalf("a $10 order extends the badge by 60 days: %v", summary.SponsorExpiresAt)
	}
	if _, err := f.service.Order(ctx, member, owned.ID, ""); err != nil {
		t.Fatal(err)
	}
	summary, _ = f.repo.User(member.UserID)
	if !summary.SponsorExpiresAt.Equal(now.Add(60 * 24 * time.Hour)) {
		t.Fatalf("repeated polling must not extend twice: %v", summary.SponsorExpiresAt)
	}

	anonymous := f.seed(sponsor.Order{ProviderOrderID: "idr-anon", AmountCents: 500})
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-anon", Status: sponsor.StatusExpired, AmountCents: 500})
	token := "signed:sponsor-order:" + strconv.Itoa(anonymous.ID) + ":idr-anon"
	view, err = f.service.Order(ctx, guest, anonymous.ID, token)
	if err != nil {
		t.Fatal(err)
	}
	if !view.Full || view.Order.Status != sponsor.StatusExpired || view.Order.ProviderOrderID != "idr-anon" {
		t.Fatalf("token holder syncs the anonymous order: %+v", view)
	}
	if _, err := f.service.Order(ctx, guest, 999, ""); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
}

func TestOrderStatusIgnoresProviderFailuresAndMismatches(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	order := f.seed(sponsor.Order{ProviderOrderID: "idr-x", AmountCents: 1000, UserID: ptr(member.UserID)})
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-x", Status: sponsor.StatusDone, AmountCents: 1})
	view, err := f.service.Order(ctx, member, order.ID, "")
	if err != nil || view.Order.Status != sponsor.StatusNew {
		t.Fatalf("an amount mismatch must not complete the order: %+v %v", view, err)
	}
	f.provider.Fail = errors.New("provider down")
	view, err = f.service.Order(ctx, member, order.ID, "")
	if err != nil || view.Order.Status != sponsor.StatusNew || !view.Full {
		t.Fatalf("provider failures fall back to the local status: %+v %v", view, err)
	}
}

func TestHandleCallback(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	expires := now.Add(10 * 24 * time.Hour)
	f.repo.AddUser(user.Summary{ID: member.UserID, Name: "member", SponsorExpiresAt: &expires})
	order := f.seed(sponsor.Order{ProviderOrderID: "idr-cb", AmountCents: 500, UserID: ptr(member.UserID)})
	_ = f.cache.Set(ctx, sponsor.WallCachePrefix+"p1:ps10", sponsor.WallPage{}, time.Minute)
	_ = f.cache.Set(ctx, "ad:placement:home", []int{}, time.Minute)

	if err := f.service.HandleCallback(ctx, "unknown"); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("unknown orders are rejected: %v", err)
	}
	if err := f.service.HandleCallback(ctx, "idr-cb"); err != nil {
		t.Fatalf("provider still NEW is a no-op: %v", err)
	}
	if stored, _ := f.repo.Get(ctx, order.ID); stored.Status != sponsor.StatusNew {
		t.Fatalf("order changed although the provider says NEW: %+v", stored)
	}
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-cb", Status: sponsor.StatusDone, AmountCents: 900})
	if err := f.service.HandleCallback(ctx, "idr-cb"); !errors.Is(err, sponsor.ErrProviderVerificationFailed) {
		t.Fatalf("amount mismatch must be rejected: %v", err)
	}
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-other", Status: sponsor.StatusDone, AmountCents: 500})
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-cb", Status: sponsor.StatusDone, AmountCents: 500})
	if err := f.service.HandleCallback(ctx, "idr-cb"); err != nil {
		t.Fatal(err)
	}
	stored, _ := f.repo.Get(ctx, order.ID)
	if stored.Status != sponsor.StatusDone || !stored.CallbackVerified || stored.PaidAt == nil {
		t.Fatalf("verified callback completes the order: %+v", stored)
	}
	summary, _ := f.repo.User(member.UserID)
	if !summary.SponsorExpiresAt.Equal(expires.Add(30 * 24 * time.Hour)) {
		t.Fatalf("$5 stacks 30 days on the unexpired badge: %v", summary.SponsorExpiresAt)
	}
	if keys := f.cache.Keys(); len(keys) != 1 || keys[0] != "ad:placement:home" {
		t.Fatalf("only the wall cache is invalidated: %v", keys)
	}
	calls := f.provider.InfoCalls
	if err := f.service.HandleCallback(ctx, "idr-cb"); err != nil || f.provider.InfoCalls != calls {
		t.Fatalf("DONE orders short-circuit without a provider call: %v", err)
	}

	refund := f.seed(sponsor.Order{ProviderOrderID: "idr-refund", AmountCents: 300, Status: sponsor.StatusExpired})
	f.provider.Put(sponsor.ProviderOrder{ID: "idr-refund", Status: sponsor.StatusRefund, AmountCents: 300})
	if err := f.service.HandleCallback(ctx, "idr-refund"); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, refund.ID); stored.Status != sponsor.StatusRefund || !stored.CallbackVerified || stored.PaidAt != nil {
		t.Fatalf("verified refund: %+v", stored)
	}

	f.provider.Fail = errors.New("down")
	late := f.seed(sponsor.Order{ProviderOrderID: "idr-late", AmountCents: 300, Status: sponsor.StatusExpired})
	if err := f.service.HandleCallback(ctx, "idr-late"); err == nil {
		t.Fatal("provider failures must surface so the provider retries")
	}
	if stored, _ := f.repo.Get(ctx, late.ID); stored.Status != sponsor.StatusExpired {
		t.Fatalf("order changed without verification: %+v", stored)
	}
}

func TestAdminStatusAndDelete(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	paidAt := now.Add(-time.Hour)
	order := f.seed(sponsor.Order{ProviderOrderID: "idr-admin", AmountCents: 200, UserID: ptr(member.UserID)})
	if err := f.service.AdminUpdateStatus(ctx, 999, sponsor.StatusDone); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
	if err := f.service.AdminUpdateStatus(ctx, order.ID, sponsor.StatusDone); err != nil {
		t.Fatal(err)
	}
	summary, _ := f.repo.User(member.UserID)
	if summary.SponsorExpiresAt == nil || !summary.SponsorExpiresAt.Equal(now.Add(12*24*time.Hour)) {
		t.Fatalf("admin DONE extends the badge: %v", summary.SponsorExpiresAt)
	}
	if err := f.service.AdminUpdateStatus(ctx, order.ID, sponsor.StatusDone); err != nil {
		t.Fatal(err)
	}
	summary, _ = f.repo.User(member.UserID)
	if !summary.SponsorExpiresAt.Equal(now.Add(12 * 24 * time.Hour)) {
		t.Fatalf("re-marking DONE must not extend again: %v", summary.SponsorExpiresAt)
	}
	already := f.seed(sponsor.Order{ProviderOrderID: "idr-paidat", AmountCents: 1, PaidAt: &paidAt, Status: sponsor.StatusRefund})
	if err := f.service.AdminUpdateStatus(ctx, already.ID, sponsor.StatusDone); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, already.ID); !stored.PaidAt.Equal(paidAt) {
		t.Fatalf("admin keeps an existing paid_at: %+v", stored)
	}
	if err := f.service.AdminDelete(ctx, order.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.service.AdminDelete(ctx, order.ID); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("double delete: %v", err)
	}
}

func TestWallIsCachedPerPage(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	paid := now.Add(-time.Hour)
	f.seed(sponsor.Order{ProviderOrderID: "idr-wall", AmountCents: 1000, Status: sponsor.StatusDone, PaidAt: &paid, SponsorName: ptr("Alice")})
	first, err := f.service.Wall(ctx, sponsor.Page{Number: 1, Size: 10})
	if err != nil || first.Total != 1 || len(first.Entries) != 1 {
		t.Fatalf("wall: %+v %v", first, err)
	}
	if keys := f.cache.Keys(); !slices.Contains(keys, "sponsor:wall:p1:ps10") {
		t.Fatalf("wall cache key: %v", keys)
	}
	f.seed(sponsor.Order{ProviderOrderID: "idr-wall-2", AmountCents: 1000, Status: sponsor.StatusDone, PaidAt: &paid})
	cached, _ := f.service.Wall(ctx, sponsor.Page{Number: 1, Size: 10})
	if cached.Total != 1 {
		t.Fatalf("second read must come from the cache: %+v", cached)
	}
}

func TestExpireStaleOrders(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	past := now.Add(-time.Minute)
	stale := f.seed(sponsor.Order{ProviderOrderID: "idr-stale", AmountCents: 100, ExpiresAt: &past})
	if err := f.service.ExpireStaleOrders(ctx); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, stale.ID); stored.Status != sponsor.StatusExpired {
		t.Fatalf("stale order not expired: %+v", stored)
	}
}
