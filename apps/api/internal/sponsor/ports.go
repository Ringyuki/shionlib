package sponsor

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, in NewOrder) (Order, error)
	Get(ctx context.Context, id int) (Order, error)
	Lock(ctx context.Context, id int) (Order, error)
	FindByProviderOrderID(ctx context.Context, providerOrderID string) (Order, error)
	SetPaymentMethod(ctx context.Context, id int, method string) error
	ApplyStatus(ctx context.Context, id int, change StatusChange) error
	Delete(ctx context.Context, id int) error
	List(ctx context.Context, filter ListFilter, page Page) ([]Order, int, error)
	Wall(ctx context.Context, page Page) ([]WallEntry, int, error)
	Stats(ctx context.Context) (Stats, error)
	PaidSince(ctx context.Context, since time.Time) (int64, error)
	ExpireStale(ctx context.Context, now time.Time) (int, error)
	ExtendSponsorship(ctx context.Context, userID int, by time.Duration, now time.Time) error
}

type Provider interface {
	Ready() bool
	CreateOrder(ctx context.Context, in ProviderOrderRequest) (string, error)
	OrderInfo(ctx context.Context, providerOrderID string) (ProviderOrder, error)
	PayOrder(ctx context.Context, in PaymentRequest) (Payment, error)
	CallbackOrderID(callback Callback) string
	Method(id string) PaymentMethod
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type Signer interface {
	Sign(message string) string
	Verify(message, signature string) bool
}
