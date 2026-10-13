package sponsortest

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

const ProviderName = "testpay"

type Provider struct {
	mu        sync.Mutex
	next      int
	orders    map[string]sponsor.ProviderOrder
	Created   []sponsor.ProviderOrderRequest
	Payments  []sponsor.PaymentRequest
	InfoCalls int
	Fail      error
	Methods   []sponsor.PaymentMethod
	ExpiresAt *time.Time
	Unready   bool
	Brands    map[string]sponsor.MethodBrand
}

func (p *Provider) Ready() bool {
	return !p.Unready
}

func (p *Provider) CallbackOrderID(callback sponsor.Callback) string {
	return strings.TrimSpace(string(callback.Body))
}

func (p *Provider) Method(id string) sponsor.PaymentMethod {
	return sponsor.PaymentMethod{ID: id, Name: strings.ToUpper(id), Brand: p.Brands[id]}
}

func NewProvider() *Provider {
	return &Provider{orders: map[string]sponsor.ProviderOrder{}}
}

func (p *Provider) Put(order sponsor.ProviderOrder) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.orders[order.ID] = order
}

func (p *Provider) SetStatus(id string, status sponsor.Status) {
	p.mu.Lock()
	defer p.mu.Unlock()
	order := p.orders[id]
	order.ID = id
	order.Status = status
	p.orders[id] = order
}

func (p *Provider) CreateOrder(_ context.Context, in sponsor.ProviderOrderRequest) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Fail != nil {
		return "", p.Fail
	}
	p.next++
	id := fmt.Sprintf("pay-%d", p.next)
	p.Created = append(p.Created, in)
	p.orders[id] = sponsor.ProviderOrder{ID: id, Status: sponsor.StatusNew, AmountCents: in.AmountCents, PaymentMethods: p.Methods, ExpiresAt: p.ExpiresAt}
	return id, nil
}

func (p *Provider) OrderInfo(_ context.Context, providerOrderID string) (sponsor.ProviderOrder, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.InfoCalls++
	if p.Fail != nil {
		return sponsor.ProviderOrder{}, p.Fail
	}
	order, ok := p.orders[providerOrderID]
	if !ok {
		return sponsor.ProviderOrder{}, sponsor.ErrProviderRequestFailed.WithArgs(map[string]any{"message": "order not found"})
	}
	return order, nil
}

func (p *Provider) PayOrder(_ context.Context, in sponsor.PaymentRequest) (sponsor.Payment, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Fail != nil {
		return sponsor.Payment{}, p.Fail
	}
	p.Payments = append(p.Payments, in)
	currency := "CNY"
	amount := sponsor.Amount(p.orders[in.ProviderOrderID].AmountCents)
	return sponsor.Payment{PayURL: "https://pay.example/" + in.ProviderOrderID, PayCurrency: &currency, Amount: &amount}, nil
}

type Signer struct{}

func (Signer) Sign(message string) string {
	return "signed:" + message
}

func (Signer) Verify(message, signature string) bool {
	return signature == "signed:"+message
}
