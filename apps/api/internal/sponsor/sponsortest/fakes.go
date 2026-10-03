package sponsortest

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
)

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
	id := fmt.Sprintf("idr-%d", p.next)
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

type Cache struct {
	mu      sync.Mutex
	entries map[string][]byte
}

func NewCache() *Cache {
	return &Cache{entries: map[string][]byte{}}
}

func (c *Cache) Get(_ context.Context, key string, dst any) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	raw, ok := c.entries[key]
	if !ok {
		return false, nil
	}
	return true, json.Unmarshal(raw, dst)
}

func (c *Cache) Set(_ context.Context, key string, value any, _ time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = raw
	return nil
}

func (c *Cache) DeletePrefix(_ context.Context, prefix string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.entries {
		if strings.HasPrefix(key, prefix) {
			delete(c.entries, key)
		}
	}
	return nil
}

func (c *Cache) Keys() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	keys := make([]string, 0, len(c.entries))
	for key := range c.entries {
		keys = append(keys, key)
	}
	return keys
}
