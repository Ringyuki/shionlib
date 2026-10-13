package sponsor_test

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
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
	service  *sponsor.Service
}

func newFixture(enabled bool) fixture {
	repo := sponsortest.NewMemoryRepository(func() time.Time { return now })
	repo.AddUser(user.Summary{ID: member.UserID, Name: "member"})
	provider := sponsortest.NewProvider()
	options := sponsor.Options{Provider: sponsortest.ProviderName, CallbackURL: callbackURL, ClockOffset: 8 * time.Hour}
	settings := settingtest.Set(settingtest.Source{}, sponsor.Enabled, enabled)
	providers := map[string]sponsor.Provider{sponsortest.ProviderName: provider}
	service := sponsor.NewService(repo, providers, &txtest.Immediate{}, sponsortest.Signer{}, settings, options, func() time.Time { return now })
	return fixture{repo: repo, provider: provider, service: service}
}

func callbackURL(provider string) string {
	return "https://shionlib.test/api/sponsor/webhook/" + provider
}

func callback(providerOrderID string) sponsor.Callback {
	return sponsor.Callback{Body: []byte(providerOrderID)}
}

func (f fixture) seed(order sponsor.Order) sponsor.Order {
	if order.ProviderOrderID == "" {
		order.ProviderOrderID = "pay-seed"
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
	f.provider.Methods = []sponsor.PaymentMethod{{ID: "alipay", Name: "Alipay", Brand: sponsor.BrandAlipay}}

	created, err := f.service.CreateOrder(ctx, member, sponsor.CreateOrderInput{AmountCents: 1050, Name: "Alice", Message: ""})
	if err != nil {
		t.Fatal(err)
	}
	if created.ProviderOrderID != "pay-1" || len(created.PaymentMethods) != 1 || created.ExpiresAt == nil || !created.ExpiresAt.Equal(providerExpiry) {
		t.Fatalf("unexpected created order %+v", created)
	}
	if created.AccessToken != "signed:sponsor-order:1:pay-1" {
		t.Fatalf("access token must sign the order identity: %q", created.AccessToken)
	}
	stored, _ := f.repo.Get(ctx, created.OrderID)
	if stored.UserID == nil || *stored.UserID != member.UserID || stored.SponsorName == nil || *stored.SponsorName != "Alice" || stored.Message != nil || stored.Provider != sponsortest.ProviderName || !stored.ExpiresAt.Equal(providerExpiry) {
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
	pending := f.seed(sponsor.Order{ProviderOrderID: "pay-pay", AmountCents: 800})
	paid := f.seed(sponsor.Order{ProviderOrderID: "pay-paid", AmountCents: 800, Status: sponsor.StatusDone})
	expired := f.seed(sponsor.Order{ProviderOrderID: "pay-expired", AmountCents: 800, Status: sponsor.StatusExpired})
	refunded := f.seed(sponsor.Order{ProviderOrderID: "pay-refund", AmountCents: 800, Status: sponsor.StatusRefund})

	payment, err := f.service.PayOrder(ctx, pending.ID, sponsor.PayInput{Method: "alipay", RedirectURL: ptr("https://shionlib.test/done")})
	if err != nil {
		t.Fatal(err)
	}
	if payment.PayURL != "https://pay.example/pay-pay" {
		t.Fatalf("unexpected payment %+v", payment)
	}
	request := f.provider.Payments[0]
	if request.CallbackURL != "https://shionlib.test/api/sponsor/webhook/testpay" || request.Method != "alipay" || request.RedirectURL == nil {
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
	owned := f.seed(sponsor.Order{ProviderOrderID: "pay-owned", AmountCents: 1000, UserID: ptr(member.UserID), SponsorName: ptr("Alice"), Message: ptr("hi"), PaymentMethod: ptr("alipay")})
	f.provider.SetStatus("pay-owned", sponsor.StatusDone)
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-owned", Status: sponsor.StatusDone, AmountCents: 1000})

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

	anonymous := f.seed(sponsor.Order{ProviderOrderID: "pay-anon", AmountCents: 500})
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-anon", Status: sponsor.StatusExpired, AmountCents: 500})
	token := "signed:sponsor-order:" + strconv.Itoa(anonymous.ID) + ":pay-anon"
	view, err = f.service.Order(ctx, guest, anonymous.ID, token)
	if err != nil {
		t.Fatal(err)
	}
	if !view.Full || view.Order.Status != sponsor.StatusExpired || view.Order.ProviderOrderID != "pay-anon" {
		t.Fatalf("token holder syncs the anonymous order: %+v", view)
	}
	if _, err := f.service.Order(ctx, guest, 999, ""); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
}

func TestOrderStatusIgnoresProviderFailuresAndMismatches(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	order := f.seed(sponsor.Order{ProviderOrderID: "pay-x", AmountCents: 1000, UserID: ptr(member.UserID)})
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-x", Status: sponsor.StatusDone, AmountCents: 1})
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
	order := f.seed(sponsor.Order{ProviderOrderID: "pay-cb", AmountCents: 500, UserID: ptr(member.UserID)})

	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("unknown")); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("unknown orders are rejected: %v", err)
	}
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-cb")); err != nil {
		t.Fatalf("provider still NEW is a no-op: %v", err)
	}
	if stored, _ := f.repo.Get(ctx, order.ID); stored.Status != sponsor.StatusNew {
		t.Fatalf("order changed although the provider says NEW: %+v", stored)
	}
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-cb", Status: sponsor.StatusDone, AmountCents: 900})
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-cb")); !errors.Is(err, sponsor.ErrProviderVerificationFailed) {
		t.Fatalf("amount mismatch must be rejected: %v", err)
	}
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-other", Status: sponsor.StatusDone, AmountCents: 500})
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-cb", Status: sponsor.StatusDone, AmountCents: 500})
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-cb")); err != nil {
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
	calls := f.provider.InfoCalls
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-cb")); err != nil || f.provider.InfoCalls != calls {
		t.Fatalf("DONE orders short-circuit without a provider call: %v", err)
	}

	refund := f.seed(sponsor.Order{ProviderOrderID: "pay-refund", AmountCents: 300, Status: sponsor.StatusExpired})
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-refund", Status: sponsor.StatusRefund, AmountCents: 300})
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-refund")); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, refund.ID); stored.Status != sponsor.StatusRefund || !stored.CallbackVerified || stored.PaidAt != nil {
		t.Fatalf("verified refund: %+v", stored)
	}

	f.provider.Fail = errors.New("down")
	late := f.seed(sponsor.Order{ProviderOrderID: "pay-late", AmountCents: 300, Status: sponsor.StatusExpired})
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-late")); err == nil {
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
	order := f.seed(sponsor.Order{ProviderOrderID: "pay-admin", AmountCents: 200, UserID: ptr(member.UserID)})
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
	already := f.seed(sponsor.Order{ProviderOrderID: "pay-paidat", AmountCents: 1, PaidAt: &paidAt, Status: sponsor.StatusRefund})
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

func TestOverviewCountsTheMonthOnTheSiteClock(t *testing.T) {
	f := newFixture(false)
	monthBegins := time.Date(2026, 9, 30, 16, 0, 0, 0, time.UTC)
	for i, order := range []sponsor.Order{
		{AmountCents: 300, Status: sponsor.StatusDone, PaidAt: ptr(monthBegins.Add(-time.Minute))},
		{AmountCents: 500, Status: sponsor.StatusDone, PaidAt: ptr(monthBegins)},
		{AmountCents: 700, Status: sponsor.StatusDone, PaidAt: ptr(now)},
		{AmountCents: 900, Status: sponsor.StatusNew},
		{AmountCents: 1100, Status: sponsor.StatusRefund, PaidAt: ptr(now)},
	} {
		order.ProviderOrderID = "pay-" + strconv.Itoa(i)
		f.repo.Seed(order)
	}
	overview, err := f.service.Overview(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if overview.Totals != (sponsor.Stats{TotalSponsors: 3, TotalAmountCents: 1500}) || overview.MonthAmountCents != 1200 || overview.Enabled {
		t.Fatalf("overview %+v", overview)
	}
	if open, err := newFixture(true).service.Overview(context.Background()); err != nil || !open.Enabled || open.MonthAmountCents != 0 {
		t.Fatalf("an open module without orders: %+v %v", open, err)
	}
}

func TestTheWallFollowsThePaymentsAtOnce(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	paid := now.Add(-time.Hour)
	f.seed(sponsor.Order{ProviderOrderID: "pay-wall", AmountCents: 1000, Status: sponsor.StatusDone, PaidAt: &paid, SponsorName: ptr("Alice")})
	first, err := f.service.Wall(ctx, sponsor.Page{Number: 1, Size: 10})
	if err != nil || first.Total != 1 || len(first.Entries) != 1 || first.Entries[0].Name == nil || *first.Entries[0].Name != "Alice" {
		t.Fatalf("wall: %+v %v", first, err)
	}
	f.seed(sponsor.Order{ProviderOrderID: "pay-wall-2", AmountCents: 1000, Status: sponsor.StatusDone, PaidAt: &now, UserID: ptr(member.UserID)})
	second, err := f.service.Wall(ctx, sponsor.Page{Number: 1, Size: 10})
	if err != nil || second.Total != 2 || second.Entries[0].Sponsor == nil || second.Entries[0].Sponsor.ID != member.UserID {
		t.Fatalf("a new payment shows on the next read: %+v %v", second, err)
	}
}

func TestStateTellsWhetherOrdersAreAcceptedAndWhatADollarGives(t *testing.T) {
	if state := newFixture(true).service.State(); !state.Enabled || state.BadgeDaysPerDollar != sponsor.DaysPerDollar {
		t.Fatalf("open: %+v", state)
	}
	if state := newFixture(false).service.State(); state.Enabled {
		t.Fatalf("closed: %+v", state)
	}
}

func TestAnOrderThatWaitsNamesWhatItCanBePaidWith(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	f.provider.Methods = []sponsor.PaymentMethod{{ID: "alipay", Name: "Alipay", Brand: sponsor.BrandAlipay}}
	created, err := f.service.CreateOrder(ctx, member, sponsor.CreateOrderInput{AmountCents: 500})
	if err != nil {
		t.Fatal(err)
	}
	view, err := f.service.Order(ctx, member, created.OrderID, "")
	if err != nil || len(view.PaymentMethods) != 1 || view.PaymentMethods[0].ID != "alipay" || view.PaymentMethods[0].Brand != sponsor.BrandAlipay {
		t.Fatalf("the owner sees the methods of a waiting order: %+v %v", view, err)
	}
	if stranger, err := f.service.Order(ctx, stranger, created.OrderID, ""); err != nil || stranger.PaymentMethods != nil {
		t.Fatalf("nobody else does: %+v %v", stranger, err)
	}
	f.provider.SetStatus(created.ProviderOrderID, sponsor.StatusDone)
	if paid, err := f.service.Order(ctx, member, created.OrderID, ""); err != nil || paid.Order.Status != sponsor.StatusDone || paid.PaymentMethods != nil {
		t.Fatalf("a paid order has nothing left to choose: %+v %v", paid, err)
	}
}

func TestExpireStaleOrders(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	past := now.Add(-time.Minute)
	stale := f.seed(sponsor.Order{ProviderOrderID: "pay-stale", AmountCents: 100, ExpiresAt: &past})
	if err := f.service.ExpireStaleOrders(ctx); err != nil {
		t.Fatal(err)
	}
	if stored, _ := f.repo.Get(ctx, stale.ID); stored.Status != sponsor.StatusExpired {
		t.Fatalf("stale order not expired: %+v", stored)
	}
}

func TestOrdersAreTakenOnlyWhileTheProviderIsReady(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	f.provider.Unready = true
	if f.service.State().Enabled {
		t.Fatal("nothing is accepted while the provider cannot take payments")
	}
	if _, err := f.service.CreateOrder(ctx, guest, sponsor.CreateOrderInput{AmountCents: 500}); !errors.Is(err, sponsor.ErrDisabled) {
		t.Fatalf("an order needs a provider that is ready: %v", err)
	}
	overview, err := f.service.Overview(ctx)
	if err != nil || !overview.Enabled || overview.ProviderReady {
		t.Fatalf("the overview tells the setting from the provider: %+v %v", overview, err)
	}
	f.provider.Unready = false
	if overview, err := f.service.Overview(ctx); err != nil || !overview.ProviderReady || !f.service.State().Enabled {
		t.Fatalf("a provider that became ready is used at once: %+v %v", overview, err)
	}
}

func TestAnOrderStaysWithTheProviderThatTookIt(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	foreign := f.repo.Seed(sponsor.Order{ProviderOrderID: "pay-foreign", Provider: "gone", AmountCents: 500, UserID: ptr(member.UserID), PaymentMethod: ptr("card")})
	f.provider.Put(sponsor.ProviderOrder{ID: "pay-foreign", Status: sponsor.StatusDone, AmountCents: 500})

	if view, err := f.service.Order(ctx, member, foreign.ID, ""); err != nil || view.Order.Status != sponsor.StatusNew || view.PaymentMethods != nil {
		t.Fatalf("an order of an absent provider is shown as it is stored: %+v %v", view, err)
	}
	if _, err := f.service.PayOrder(ctx, foreign.ID, sponsor.PayInput{Method: "alipay"}); !errors.Is(err, sponsor.ErrProviderRequestFailed) {
		t.Fatalf("an absent provider cannot be paid through: %v", err)
	}
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("pay-foreign")); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("a provider cannot settle the order of another: %v", err)
	}
	if err := f.service.HandleCallback(ctx, "gone", callback("pay-foreign")); !errors.Is(err, sponsor.ErrOrderNotFound) {
		t.Fatalf("a provider that is not wired has no callbacks: %v", err)
	}
	if err := f.service.HandleCallback(ctx, sponsortest.ProviderName, callback("")); err != nil {
		t.Fatalf("a callback that names no order is acknowledged: %v", err)
	}
	if method := f.service.MethodOf(foreign); method == nil || method.ID != "card" || method.Name != "card" || method.Brand != "" {
		t.Fatalf("a method of an absent provider keeps its id: %+v", method)
	}
}

func TestTheProviderDescribesWhatAnOrderWasPaidWith(t *testing.T) {
	f := newFixture(true)
	f.provider.Brands = map[string]sponsor.MethodBrand{"wx": sponsor.BrandWeChatPay}
	paid := f.seed(sponsor.Order{ProviderOrderID: "pay-described", AmountCents: 500, PaymentMethod: ptr("wx")})
	if method := f.service.MethodOf(paid); method == nil || method.ID != "wx" || method.Brand != sponsor.BrandWeChatPay {
		t.Fatalf("unexpected method %+v", method)
	}
	if method := f.service.MethodOf(f.seed(sponsor.Order{ProviderOrderID: "pay-untried", AmountCents: 500})); method != nil {
		t.Fatalf("an order nobody tried to pay has no method: %+v", method)
	}
}
