package idatariver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

const (
	Name             = "idatariver"
	DefaultBaseURL   = "https://open.idatariver.com"
	maxResponseBytes = 1 << 20
)

const nonZeroDigits = "123456789"

var brands = map[string]sponsor.MethodBrand{
	"alipay":        sponsor.BrandAlipay,
	"wxpay":         sponsor.BrandWeChatPay,
	"crypto":        sponsor.BrandUSDT,
	"onramp-paypal": sponsor.BrandPayPal,
	"onramp-google": sponsor.BrandGooglePay,
	"onramp-apple":  sponsor.BrandApplePay,
}

type Client struct {
	http     *http.Client
	settings setting.Source
}

func NewClient(httpClient *http.Client, settings setting.Source) *Client {
	return &Client{http: httpClient, settings: settings}
}

type account struct {
	baseURL   string
	secret    string
	projectID string
}

func (c *Client) account() account {
	baseURL := strings.TrimSpace(BaseURL.Read(c.settings))
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return account{
		baseURL:   strings.TrimSuffix(baseURL, "/"),
		secret:    strings.TrimSpace(Secret.Read(c.settings)),
		projectID: strings.TrimSpace(ProjectID.Read(c.settings)),
	}
}

func (a account) ready() bool {
	return a.secret != "" && a.projectID != ""
}

func (c *Client) Ready() bool {
	return c.account().ready()
}

func (c *Client) Method(id string) sponsor.PaymentMethod {
	return sponsor.PaymentMethod{ID: id, Name: id, Brand: brands[id]}
}

type envelope struct {
	Code   int             `json:"code"`
	Result json.RawMessage `json:"result"`
	Msg    string          `json:"msg"`
}

type createOrderBody struct {
	ProjectID string           `json:"projectId"`
	OrderInfo createOrderDraft `json:"orderInfo"`
}

type createOrderDraft struct {
	Amount  float64 `json:"amount"`
	Private bool    `json:"private"`
	Name    string  `json:"name"`
	Message string  `json:"message"`
}

type createOrderResult struct {
	OrderID string `json:"orderId"`
}

type payOrderBody struct {
	ID          string  `json:"id"`
	Method      string  `json:"method"`
	RedirectURL *string `json:"redirectUrl,omitempty"`
	CallbackURL string  `json:"callbackUrl"`
}

type payOrderResult struct {
	PayURL      string   `json:"payUrl"`
	PayCurrency *string  `json:"payCurrency"`
	Amount      *float64 `json:"amount"`
}

type paymentMethod struct {
	Method        string `json:"method"`
	Name          string `json:"name"`
	Enabled       bool   `json:"enabled"`
	RatioRange    string `json:"ratioRange"`
	FixedFeeRange string `json:"fixedFeeRange"`
}

func (m paymentMethod) fee() sponsor.MethodFee {
	return sponsor.MethodFee{Rate: charged(m.RatioRange), Fixed: charged(m.FixedFeeRange)}
}

type orderInfo struct {
	ID              string          `json:"id"`
	Status          string          `json:"status"`
	Price           float64         `json:"price"`
	MPayments       []paymentMethod `json:"mPayments"`
	ExpiredInterval float64         `json:"expiredInterval"`
	CreatedTS       float64         `json:"createdTS"`
}

func charged(text string) string {
	if !strings.ContainsAny(text, nonZeroDigits) {
		return ""
	}
	return strings.TrimSpace(text)
}

func (c *Client) CreateOrder(ctx context.Context, in sponsor.ProviderOrderRequest) (string, error) {
	body := createOrderBody{
		ProjectID: c.account().projectID,
		OrderInfo: createOrderDraft{Amount: sponsor.Amount(in.AmountCents), Private: in.IsPrivate, Name: in.Name, Message: in.Message},
	}
	var result createOrderResult
	if err := c.do(ctx, http.MethodPost, "/mapi/order/add", body, &result); err != nil {
		return "", err
	}
	if result.OrderID == "" {
		return "", invalidResponse(errors.New("provider returned an empty order id"))
	}
	return result.OrderID, nil
}

func (c *Client) PayOrder(ctx context.Context, in sponsor.PaymentRequest) (sponsor.Payment, error) {
	body := payOrderBody{ID: in.ProviderOrderID, Method: in.Method, RedirectURL: in.RedirectURL, CallbackURL: in.CallbackURL}
	var result payOrderResult
	if err := c.do(ctx, http.MethodPost, "/mapi/order/pay", body, &result); err != nil {
		return sponsor.Payment{}, err
	}
	return sponsor.Payment{PayURL: result.PayURL, PayCurrency: result.PayCurrency, Amount: result.Amount}, nil
}

func (c *Client) OrderInfo(ctx context.Context, providerOrderID string) (sponsor.ProviderOrder, error) {
	var result orderInfo
	path := "/mapi/order/info?" + url.Values{"id": {providerOrderID}}.Encode()
	if err := c.do(ctx, http.MethodGet, path, nil, &result); err != nil {
		return sponsor.ProviderOrder{}, err
	}
	order := sponsor.ProviderOrder{
		ID:             result.ID,
		Status:         toStatus(result.Status),
		AmountCents:    sponsor.CentsFromAmount(result.Price),
		PaymentMethods: []sponsor.PaymentMethod{},
	}
	for _, method := range result.MPayments {
		if !method.Enabled {
			continue
		}
		order.PaymentMethods = append(order.PaymentMethods, sponsor.PaymentMethod{
			ID:    method.Method,
			Name:  method.Name,
			Brand: brands[method.Method],
			Fee:   method.fee(),
		})
	}
	if result.CreatedTS > 0 && result.ExpiredInterval > 0 {
		expires := time.Unix(int64(math.Floor(result.CreatedTS+result.ExpiredInterval)), 0).UTC()
		order.ExpiresAt = &expires
	}
	return order, nil
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	account := c.account()
	if !account.ready() {
		return sponsor.ErrProviderRequestFailed.WithArgs(map[string]any{"message": "provider not configured"})
	}
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode idatariver request: %w", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, account.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("build idatariver request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+account.secret)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return sponsor.ErrProviderRequestFailed.Wrap(fmt.Errorf("idatariver %s %s: %w", method, path, err)).WithArgs(map[string]any{"message": "provider unreachable"})
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return sponsor.ErrProviderRequestFailed.Wrap(fmt.Errorf("read idatariver response: %w", err)).WithArgs(map[string]any{"message": "provider unreachable"})
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return sponsor.ErrProviderRequestFailed.Wrap(fmt.Errorf("idatariver %s %s returned %d", method, path, resp.StatusCode)).WithArgs(map[string]any{"message": fmt.Sprintf("HTTP %d", resp.StatusCode)})
	}
	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return invalidResponse(err)
	}
	if env.Code != 0 {
		return sponsor.ErrProviderRequestFailed.Wrap(fmt.Errorf("idatariver %s %s returned code %d", method, path, env.Code)).WithArgs(map[string]any{"message": env.Msg})
	}
	if err := json.Unmarshal(env.Result, out); err != nil {
		return invalidResponse(err)
	}
	return nil
}

func invalidResponse(cause error) error {
	return sponsor.ErrProviderRequestFailed.Wrap(fmt.Errorf("decode idatariver response: %w", cause)).WithArgs(map[string]any{"message": "invalid provider response"})
}

func toStatus(raw string) sponsor.Status {
	status := sponsor.Status(raw)
	if !status.Valid() {
		return sponsor.StatusNew
	}
	return status
}
