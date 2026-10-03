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

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

const maxResponseBytes = 1 << 20

type Options struct {
	BaseURL   string
	Secret    string
	ProjectID string
}

type Client struct {
	http      *http.Client
	baseURL   string
	secret    string
	projectID string
}

func NewClient(httpClient *http.Client, opts Options) *Client {
	return &Client{
		http:      httpClient,
		baseURL:   strings.TrimSuffix(opts.BaseURL, "/"),
		secret:    opts.Secret,
		projectID: opts.ProjectID,
	}
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
	Method        string  `json:"method"`
	Name          string  `json:"name"`
	Enabled       bool    `json:"enabled"`
	RatioRange    *string `json:"ratioRange"`
	FixedFeeRange *string `json:"fixedFeeRange"`
	Desc          *string `json:"desc"`
}

type orderInfo struct {
	ID              string          `json:"id"`
	Status          string          `json:"status"`
	Price           float64         `json:"price"`
	MPayments       []paymentMethod `json:"mPayments"`
	ExpiredInterval float64         `json:"expiredInterval"`
	CreatedTS       float64         `json:"createdTS"`
}

func (c *Client) CreateOrder(ctx context.Context, in sponsor.ProviderOrderRequest) (string, error) {
	body := createOrderBody{
		ProjectID: c.projectID,
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
			Method:        method.Method,
			Name:          method.Name,
			Enabled:       method.Enabled,
			RatioRange:    method.RatioRange,
			FixedFeeRange: method.FixedFeeRange,
			Description:   method.Desc,
		})
	}
	if result.CreatedTS > 0 && result.ExpiredInterval > 0 {
		expires := time.Unix(int64(math.Floor(result.CreatedTS+result.ExpiredInterval)), 0).UTC()
		order.ExpiresAt = &expires
	}
	return order, nil
}

func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode idatariver request: %w", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("build idatariver request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.secret)
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
