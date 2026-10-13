package idatariver_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/idatariver"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

type recorded struct {
	method string
	uri    string
	auth   string
	body   map[string]any
}

func serve(t *testing.T, status int, response string) (*idatariver.Client, *[]recorded) {
	t.Helper()
	var calls []recorded
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := recorded{method: r.Method, uri: r.URL.RequestURI(), auth: r.Header.Get("Authorization")}
		raw, _ := io.ReadAll(r.Body)
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &call.body)
		}
		calls = append(calls, call)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
	}))
	t.Cleanup(server.Close)
	return idatariver.NewClient(server.Client(), account(server.URL+"/")), &calls
}

func account(baseURL string) settingtest.Source {
	source := settingtest.Set(settingtest.Source{}, idatariver.BaseURL, baseURL)
	settingtest.Set(source, idatariver.Secret, "test-secret")
	return settingtest.Set(source, idatariver.ProjectID, "test-project")
}

func TestCreateOrder(t *testing.T) {
	client, calls := serve(t, http.StatusOK, `{"code":0,"result":{"orderId":"idr-order-123"},"msg":""}`)
	id, err := client.CreateOrder(context.Background(), sponsor.ProviderOrderRequest{AmountCents: 1050, Name: "Alice", Message: "Thanks"})
	if err != nil {
		t.Fatal(err)
	}
	if id != "idr-order-123" {
		t.Fatalf("unexpected id %q", id)
	}
	call := (*calls)[0]
	if call.method != http.MethodPost || call.uri != "/mapi/order/add" || call.auth != "Bearer test-secret" {
		t.Fatalf("unexpected request %+v", call)
	}
	info := call.body["orderInfo"].(map[string]any)
	if call.body["projectId"] != "test-project" || info["amount"] != 10.5 || info["private"] != false || info["name"] != "Alice" || info["message"] != "Thanks" {
		t.Fatalf("unexpected body %+v", call.body)
	}
}

func TestOrderInfoNormalizesTheProviderOrder(t *testing.T) {
	client, calls := serve(t, http.StatusOK, `{"code":0,"msg":"","result":{"id":"a&b","status":"DONE","price":10,"createdTS":1700000000,"expiredInterval":3600,
		"mPayments":[{"method":"alipay","name":"Alipay","enabled":true,"ratioRange":" 11.0% ","fixedFeeRange":"0.00"},{"method":"bank","name":"Bank","enabled":true,"ratioRange":"0%","fixedFeeRange":"0.30"},
			{"method":"onramp-paypal","name":"PayPal","enabled":true,"ratioRange":"4.4%","fixedFeeRange":"0.30"},{"method":"wxpay","name":"WeChat","enabled":true},{"method":"crypto","name":"USDT","enabled":false}]}}`)
	order, err := client.OrderInfo(context.Background(), "a&b")
	if err != nil {
		t.Fatal(err)
	}
	if (*calls)[0].uri != "/mapi/order/info?id=a%26b" || (*calls)[0].method != http.MethodGet {
		t.Fatalf("the provider id must be query-escaped: %+v", (*calls)[0])
	}
	if order.ID != "a&b" || order.Status != sponsor.StatusDone || order.AmountCents != 1000 {
		t.Fatalf("unexpected order %+v", order)
	}
	want := []sponsor.PaymentMethod{
		{ID: "alipay", Name: "Alipay", Brand: sponsor.BrandAlipay, Fee: sponsor.MethodFee{Rate: "11.0%"}},
		{ID: "bank", Name: "Bank", Fee: sponsor.MethodFee{Fixed: "0.30"}},
		{ID: "onramp-paypal", Name: "PayPal", Brand: sponsor.BrandPayPal, Fee: sponsor.MethodFee{Rate: "4.4%", Fixed: "0.30"}},
		{ID: "wxpay", Name: "WeChat", Brand: sponsor.BrandWeChatPay},
	}
	if !slices.Equal(order.PaymentMethods, want) {
		t.Fatalf("only enabled methods are returned, with the brand of those that are known and the fee each one charges: %+v", order.PaymentMethods)
	}
	if order.ExpiresAt == nil || !order.ExpiresAt.Equal(time.Unix(1700003600, 0)) {
		t.Fatalf("unexpected expiry %v", order.ExpiresAt)
	}
}

func TestOrderInfoWithoutPaymentsOrExpiry(t *testing.T) {
	client, _ := serve(t, http.StatusOK, `{"code":0,"msg":"","result":{"id":"x","status":"WEIRD","price":5,"mPayments":null}}`)
	order, err := client.OrderInfo(context.Background(), "x")
	if err != nil {
		t.Fatal(err)
	}
	if order.PaymentMethods == nil || len(order.PaymentMethods) != 0 || order.ExpiresAt != nil || order.Status != sponsor.StatusNew {
		t.Fatalf("unexpected order %+v", order)
	}
}

func TestPayOrder(t *testing.T) {
	client, calls := serve(t, http.StatusOK, `{"code":0,"msg":"","result":{"payUrl":"https://pay.example/1","payCurrency":"USD","amount":10}}`)
	payment, err := client.PayOrder(context.Background(), sponsor.PaymentRequest{ProviderOrderID: "idr-1", Method: "alipay", CallbackURL: "https://shionlib.test/api/sponsor/webhook/idatariver"})
	if err != nil {
		t.Fatal(err)
	}
	if payment.PayURL != "https://pay.example/1" || payment.PayCurrency == nil || *payment.PayCurrency != "USD" || payment.Amount == nil || *payment.Amount != 10 {
		t.Fatalf("unexpected payment %+v", payment)
	}
	body := (*calls)[0].body
	if _, present := body["redirectUrl"]; present || body["id"] != "idr-1" || body["callbackUrl"] != "https://shionlib.test/api/sponsor/webhook/idatariver" {
		t.Fatalf("unexpected body %+v", body)
	}
}

func TestFailuresBecomeProviderErrors(t *testing.T) {
	cases := map[string]struct {
		status   int
		response string
		message  string
	}{
		"business error": {http.StatusOK, `{"code":1001,"result":null,"msg":"parameter error"}`, "parameter error"},
		"http error":     {http.StatusBadGateway, `oops`, "HTTP 502"},
		"malformed":      {http.StatusOK, `not json`, "invalid provider response"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			client, _ := serve(t, tc.status, tc.response)
			_, err := client.CreateOrder(context.Background(), sponsor.ProviderOrderRequest{AmountCents: 100})
			if !errors.Is(err, sponsor.ErrProviderRequestFailed) {
				t.Fatalf("expected provider failure, got %v", err)
			}
			appErr, _ := apperror.From(err)
			if appErr.Args()["message"] != tc.message {
				t.Fatalf("unexpected message %v", appErr.Args())
			}
		})
	}
}

func TestNetworkFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	server.Close()
	client := idatariver.NewClient(server.Client(), account(server.URL))
	if _, err := client.OrderInfo(context.Background(), "x"); !errors.Is(err, sponsor.ErrProviderRequestFailed) {
		t.Fatalf("expected provider failure, got %v", err)
	}
}

func TestNothingIsSentUntilTheAccountIsFilledIn(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"code":0,"result":{"orderId":"idr-1"},"msg":""}`))
	}))
	t.Cleanup(server.Close)
	source := settingtest.Set(settingtest.Source{}, idatariver.BaseURL, server.URL)
	client := idatariver.NewClient(server.Client(), source)

	if client.Ready() {
		t.Fatal("a client without a secret and a project is not ready")
	}
	_, err := client.CreateOrder(context.Background(), sponsor.ProviderOrderRequest{AmountCents: 100})
	appErr, _ := apperror.From(err)
	if !errors.Is(err, sponsor.ErrProviderRequestFailed) || appErr.Args()["message"] != "provider not configured" || calls != 0 {
		t.Fatalf("expected a refusal without a request, got %v after %d calls", err, calls)
	}

	settingtest.Set(source, idatariver.Secret, " test-secret ")
	if client.Ready() {
		t.Fatal("a secret alone is not enough")
	}
	settingtest.Set(source, idatariver.ProjectID, "test-project")
	if !client.Ready() {
		t.Fatal("the settings are read on every call, so a filled account is ready at once")
	}
	if id, err := client.CreateOrder(context.Background(), sponsor.ProviderOrderRequest{AmountCents: 100}); err != nil || id != "idr-1" || calls != 1 {
		t.Fatalf("unexpected order %q %v after %d calls", id, err, calls)
	}
}

func TestMethodNamesTheBrandOfTheMethodsItKnows(t *testing.T) {
	client := idatariver.NewClient(&http.Client{}, settingtest.Source{})
	brands := map[string]sponsor.MethodBrand{
		"alipay":        sponsor.BrandAlipay,
		"wxpay":         sponsor.BrandWeChatPay,
		"crypto":        sponsor.BrandUSDT,
		"onramp-paypal": sponsor.BrandPayPal,
		"onramp-google": sponsor.BrandGooglePay,
		"onramp-apple":  sponsor.BrandApplePay,
		"bank":          "",
	}
	for id, brand := range brands {
		if got := client.Method(id); got.ID != id || got.Name != id || got.Brand != brand {
			t.Errorf("Method(%q) = %+v, want brand %q", id, got, brand)
		}
	}
}
