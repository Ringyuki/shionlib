package sponsorhttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor/sponsortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sponsorhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

var (
	owner    = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	admin    = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
)

type env struct {
	server   *apitest.Server
	repo     *sponsortest.MemoryRepository
	provider *sponsortest.Provider
}

func setup(t *testing.T, enabled bool) env {
	t.Helper()
	server := apitest.New(t)
	repo := sponsortest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.AddUser(user.Summary{ID: owner.UserID, Name: "owner"})
	provider := sponsortest.NewProvider()
	expires := time.Date(2026, 10, 3, 2, 2, 3, 0, time.UTC)
	provider.ExpiresAt = &expires
	provider.Methods = []sponsor.PaymentMethod{
		{ID: "alipay", Name: "Alipay", Brand: sponsor.BrandAlipay, Fee: sponsor.MethodFee{Rate: "3.0%", Fixed: "0.30"}},
		{ID: "bank", Name: "Bank transfer"},
	}
	provider.Brands = map[string]sponsor.MethodBrand{"alipay": sponsor.BrandAlipay}
	options := sponsor.Options{Provider: sponsortest.ProviderName, CallbackURL: func(name string) string { return "https://shionlib.test/api/sponsor/webhook/" + name }}
	settings := settingtest.Set(settingtest.Source{}, sponsor.Enabled, enabled)
	providers := map[string]sponsor.Provider{sponsortest.ProviderName: provider}
	service := sponsor.NewService(repo, providers, &txtest.Immediate{}, sponsortest.Signer{}, settings, options, func() time.Time { return apitest.Now })
	sponsorhttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, repo: repo, provider: provider}
}

func ptr[T any](v T) *T {
	return &v
}

func TestCreateOrderShape(t *testing.T) {
	e := setup(t, true)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order", As: &owner, Body: map[string]any{"amount": 10.5, "name": "Alice", "isPrivate": false}})
	e.server.Expect(resp, http.StatusCreated, 0)
	want := `{"orderId":1,"providerOrderId":"pay-1","paymentMethods":[{"id":"alipay","name":"Alipay","brand":"alipay","fee_rate":"3.0%","fee_fixed":"0.30"},{"id":"bank","name":"Bank transfer","brand":null,"fee_rate":null,"fee_fixed":null}],"expiresAt":"2026-10-03T02:02:03.000Z","accessToken":"signed:sponsor-order:1:pay-1"}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected body\n got %s\nwant %s", resp.Data, want)
	}
	stored, _ := e.repo.Get(t.Context(), 1)
	if stored.AmountCents != 1050 || stored.UserID == nil || *stored.UserID != owner.UserID {
		t.Fatalf("unexpected stored order %+v", stored)
	}
	anonymous := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order", Body: map[string]any{"amount": 1}})
	e.server.Expect(anonymous, http.StatusCreated, 0)
}

func TestCreateOrderValidationAndDisabled(t *testing.T) {
	e := setup(t, true)
	for _, body := range []map[string]any{{}, {"amount": 0.5}, {"amount": 10001}, {"amount": "10"}, {"amount": 5, "name": strings.Repeat("x", 101)}, {"amount": 5, "extra": true}} {
		e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order", Body: body}), http.StatusUnprocessableEntity, 100101)
	}
	disabled := setup(t, false)
	disabled.server.Expect(disabled.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order", Body: map[string]any{"amount": 5}}), http.StatusServiceUnavailable, 570106)
}

func TestPayOrder(t *testing.T) {
	e := setup(t, true)
	order := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-9", AmountCents: 500})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-9", Status: sponsor.StatusNew, AmountCents: 500})
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/" + strconv.Itoa(order.ID) + "/pay", Body: map[string]any{"method": "alipay"}})
	e.server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"payUrl":"https://pay.example/pay-9","payCurrency":"CNY","amount":5}` {
		t.Fatalf("unexpected payment %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/" + strconv.Itoa(order.ID) + "/pay", Body: map[string]any{"method": ""}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/999/pay", Body: map[string]any{"method": "alipay"}}), http.StatusNotFound, 570101)
	paid := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-10", AmountCents: 500, Status: sponsor.StatusDone})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/" + strconv.Itoa(paid.ID) + "/pay", Body: map[string]any{"method": "alipay"}}), http.StatusConflict, 570102)
	expired := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-11", AmountCents: 500, Status: sponsor.StatusExpired})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/" + strconv.Itoa(expired.ID) + "/pay", Body: map[string]any{"method": "alipay"}}), http.StatusGone, 570103)
	e.provider.Fail = sponsor.ErrProviderRequestFailed.WithArgs(map[string]any{"message": "parameter error"})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/order/" + strconv.Itoa(order.ID) + "/pay", Body: map[string]any{"method": "alipay"}}), http.StatusBadGateway, 570104)
}

func TestOrderStatusAccess(t *testing.T) {
	e := setup(t, true)
	order := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-5", AmountCents: 1000, UserID: ptr(owner.UserID), SponsorName: ptr("Alice"), Message: ptr("hi"), IsPrivate: true, PaymentMethod: ptr("alipay")})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-5", Status: sponsor.StatusDone, AmountCents: 1000})
	path := "/sponsor/order/" + strconv.Itoa(order.ID)

	redacted := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &stranger})
	e.server.Expect(redacted, http.StatusOK, 0)
	if string(redacted.Data) != `{"order":{"id":1,"providerOrderId":"","amount":10,"status":"NEW","sponsorName":null,"user":null,"message":null,"isPrivate":true,"paymentMethod":null,"paidAt":null,"expiresAt":null,"created":"2026-10-03T01:02:03.000Z"},"badge_until":null,"payment_methods":[]}` {
		t.Fatalf("strangers get a redacted order without a sync: %s", redacted.Data)
	}
	full := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &owner})
	e.server.Expect(full, http.StatusOK, 0)
	if string(full.Data) != `{"order":{"id":1,"providerOrderId":"pay-5","amount":10,"status":"DONE","sponsorName":"Alice","user":{"id":1,"name":"owner","avatar":null,"is_sponsor":true},"message":"hi","isPrivate":true,"paymentMethod":{"id":"alipay","name":"ALIPAY","brand":"alipay","fee_rate":null,"fee_fixed":null},"paidAt":"2026-10-03T01:02:03.000Z","expiresAt":null,"created":"2026-10-03T01:02:03.000Z"},"badge_until":"2026-12-02T01:02:03.000Z","payment_methods":[]}` {
		t.Fatalf("owner syncs and sees the full order: %s", full.Data)
	}

	anonymous := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-6", AmountCents: 100})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-6", Status: sponsor.StatusDone, AmountCents: 100})
	withToken := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/order/" + strconv.Itoa(anonymous.ID) + "?token=signed:sponsor-order:2:pay-6"})
	e.server.Expect(withToken, http.StatusOK, 0)
	var view struct {
		Order map[string]any `json:"order"`
	}
	withToken.Decode(t, &view)
	if view.Order["status"] != "DONE" || view.Order["providerOrderId"] != "pay-6" {
		t.Fatalf("token holder syncs the anonymous order: %s", withToken.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/order/999"}), http.StatusNotFound, 570101)
}

func TestWallAndStats(t *testing.T) {
	e := setup(t, true)
	paid := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	e.repo.Seed(sponsor.Order{ProviderOrderID: "a", AmountCents: 1050, Status: sponsor.StatusDone, PaidAt: &paid, SponsorName: ptr("Alice"), Message: ptr("Thanks!"), UserID: ptr(owner.UserID)})
	e.repo.Seed(sponsor.Order{ProviderOrderID: "b", AmountCents: 50, Status: sponsor.StatusDone, PaidAt: &paid, IsPrivate: true})
	e.repo.Seed(sponsor.Order{ProviderOrderID: "c", AmountCents: 300, Status: sponsor.StatusDone, PaidAt: ptr(paid.Add(-time.Hour)), SponsorName: ptr("A passer-by")})
	e.repo.Describe(owner.UserID, "user/1/cover.webp", "plays old games")
	wall := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/wall?page=1&pageSize=10"})
	e.server.Expect(wall, http.StatusOK, 0)
	if string(wall.Data) != `{"items":[{"id":1,"user":{"id":1,"name":"owner","avatar":null,"cover":"user/1/cover.webp","bio":"plays old games","is_sponsor":false},"name":null,"message":"Thanks!","sponsored_at":"2026-09-01T00:00:00.000Z"},{"id":3,"user":null,"name":"A passer-by","message":null,"sponsored_at":"2026-08-31T23:00:00.000Z"}],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":10,"totalPages":1,"currentPage":1}}` {
		t.Fatalf("unexpected wall %s", wall.Data)
	}
	state := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/state"})
	e.server.Expect(state, http.StatusOK, 0)
	if string(state.Data) != `{"enabled":true,"badge_days_per_dollar":6}` {
		t.Fatalf("unexpected state %s", state.Data)
	}
	stats := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/stats"})
	e.server.Expect(stats, http.StatusOK, 0)
	if string(stats.Data) != `{"totalSponsors":3,"totalAmount":14}` {
		t.Fatalf("unexpected stats %s", stats.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/sponsor/wall?pageSize=51"}), http.StatusUnprocessableEntity, 100101)
}

func TestWebhook(t *testing.T) {
	e := setup(t, true)
	plain := map[string]string{"Content-Type": "text/plain"}
	order := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-hook", AmountCents: 500})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-hook", Status: sponsor.StatusDone, AmountCents: 500})

	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/testpay", Body: "pay-hook", Header: plain})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"received":true}` {
		t.Fatalf("unexpected webhook body %s", resp.Data)
	}
	if stored, _ := e.repo.Get(t.Context(), order.ID); stored.Status != sponsor.StatusDone || !stored.CallbackVerified {
		t.Fatalf("webhook must verify and complete the order: %+v", stored)
	}

	form := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-form", AmountCents: 500})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-form", Status: sponsor.StatusRefund, AmountCents: 500})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/testpay", Body: "pay-form", Header: plain}), http.StatusOK, 0)
	if stored, _ := e.repo.Get(t.Context(), form.ID); stored.Status != sponsor.StatusRefund {
		t.Fatalf("a callback can refund an order: %+v", stored)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/testpay", Body: " ", Header: plain}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/testpay", Body: "forged", Header: plain}), http.StatusNotFound, 570101)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/nobody", Body: "pay-hook", Header: plain}), http.StatusNotFound, 570101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/No%20Body", Body: "pay-hook", Header: plain}), http.StatusUnprocessableEntity, 100101)

	mismatch := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-cheap", AmountCents: 500})
	e.provider.Put(sponsor.ProviderOrder{ID: "pay-cheap", Status: sponsor.StatusDone, AmountCents: 100})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/sponsor/webhook/testpay", Body: "pay-cheap", Header: plain}), http.StatusBadGateway, 570105)
	if stored, _ := e.repo.Get(t.Context(), mismatch.ID); stored.Status != sponsor.StatusNew {
		t.Fatalf("mismatched callbacks must not change the order: %+v", stored)
	}
}

func TestAdminRoutes(t *testing.T) {
	e := setup(t, true)
	order := e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-adm", AmountCents: 200, UserID: ptr(owner.UserID)})
	e.repo.Seed(sponsor.Order{ProviderOrderID: "pay-adm-2", AmountCents: 200, Status: sponsor.StatusExpired})
	path := "/admin/sponsor/orders/" + strconv.Itoa(order.ID)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/sponsor/orders"}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/sponsor/orders", As: &owner}), http.StatusForbidden, 403)

	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/sponsor/orders?status=EXPIRED", As: &admin})
	e.server.Expect(list, http.StatusOK, 0)
	var page struct {
		Items []map[string]any `json:"items"`
		Meta  map[string]int   `json:"meta"`
	}
	list.Decode(t, &page)
	if len(page.Items) != 1 || page.Items[0]["providerOrderId"] != "pay-adm-2" || page.Meta["totalItems"] != 1 {
		t.Fatalf("unexpected admin list %s", list.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/sponsor/orders?status=PAID", As: &admin}), http.StatusUnprocessableEntity, 100101)

	detail := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &admin})
	e.server.Expect(detail, http.StatusOK, 0)

	update := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path + "/status", As: &admin, Body: map[string]any{"status": "DONE"}})
	e.server.Expect(update, http.StatusOK, 0)
	if update.HasData {
		t.Fatalf("void endpoints omit data: %s", update.Body)
	}
	if stored, _ := e.repo.Get(t.Context(), order.ID); stored.Status != sponsor.StatusDone || stored.PaidAt == nil {
		t.Fatalf("status override: %+v", stored)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path + "/status", As: &admin, Body: map[string]any{"status": "PAID"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/sponsor/orders/999/status", As: &admin, Body: map[string]any{"status": "DONE"}}), http.StatusNotFound, 570101)

	stats := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/sponsor/stats", As: &admin})
	e.server.Expect(stats, http.StatusOK, 0)
	if string(stats.Data) != `{"totalSponsors":1,"totalAmount":2,"monthAmount":2,"enabled":true,"providerReady":true}` {
		t.Fatalf("unexpected admin stats %s", stats.Data)
	}

	deleted := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &admin})
	e.server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &admin}), http.StatusNotFound, 570101)
}
