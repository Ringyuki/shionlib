package sponsor

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type transitionSource int

const (
	fromPoll transitionSource = iota
	fromCallback
	fromAdmin
)

type CreateOrderInput struct {
	AmountCents int64
	IsPrivate   bool
	Name        string
	Message     string
}

type PayInput struct {
	Method      string
	RedirectURL *string
}

func (t transitionSource) allows(current, target Status) bool {
	switch t {
	case fromPoll:
		return current == StatusNew && target != StatusNew
	case fromCallback:
		return current != StatusDone && (target == StatusDone || target == StatusRefund)
	default:
		return true
	}
}

type Status string

const (
	StatusNew     Status = "NEW"
	StatusDone    Status = "DONE"
	StatusExpired Status = "EXPIRED"
	StatusRefund  Status = "REFUND"
)

func (s Status) Valid() bool {
	return s == StatusNew || s == StatusDone || s == StatusExpired || s == StatusRefund
}

const (
	DaysPerDollar         = 6
	MaxNameLength         = 100
	MaxMessageLength      = 500
	MaxPaymentMethod      = 50
	FallbackOrderLifetime = time.Hour
	WallCacheTTL          = 5 * time.Minute
	WallCachePrefix       = "sponsor:wall:"
	amountToleranceCents  = 1
)

type Order struct {
	ID               int
	ProviderOrderID  string
	Provider         string
	AmountCents      int64
	PaymentMethod    *string
	Status           Status
	SponsorName      *string
	Message          *string
	IsPrivate        bool
	UserID           *int
	User             *user.Summary
	ExpiresAt        *time.Time
	PaidAt           *time.Time
	CallbackVerified bool
	Created          time.Time
}

func (o Order) OwnedBy(who actor.Actor) bool {
	return who.Authenticated() && o.UserID != nil && *o.UserID == who.UserID
}

func (o Order) redacted() Order {
	o.ProviderOrderID = ""
	o.SponsorName = nil
	o.Message = nil
	o.UserID = nil
	o.User = nil
	o.PaymentMethod = nil
	return o
}

type NewOrder struct {
	ProviderOrderID string
	Provider        string
	AmountCents     int64
	SponsorName     *string
	Message         *string
	IsPrivate       bool
	UserID          *int
	ExpiresAt       time.Time
}

type StatusChange struct {
	Status           Status
	PaidAt           *time.Time
	CallbackVerified bool
}

type PaymentMethod struct {
	Method        string
	Name          string
	Enabled       bool
	RatioRange    *string
	FixedFeeRange *string
	Description   *string
}

type ProviderOrder struct {
	ID             string
	Status         Status
	AmountCents    int64
	PaymentMethods []PaymentMethod
	ExpiresAt      *time.Time
}

func (p ProviderOrder) matches(order Order) bool {
	diff := p.AmountCents - order.AmountCents
	return p.ID == order.ProviderOrderID && diff <= amountToleranceCents && diff >= -amountToleranceCents
}

type ProviderOrderRequest struct {
	AmountCents int64
	IsPrivate   bool
	Name        string
	Message     string
}

type PaymentRequest struct {
	ProviderOrderID string
	Method          string
	RedirectURL     *string
	CallbackURL     string
}

type Payment struct {
	PayURL      string
	PayCurrency *string
	Amount      *float64
}

type CreatedOrder struct {
	OrderID         int
	ProviderOrderID string
	PaymentMethods  []PaymentMethod
	ExpiresAt       *time.Time
	AccessToken     string
}

type OrderView struct {
	Order Order
	Full  bool
}

type WallEntry struct {
	ID          int
	SponsorName *string
	Message     *string
	User        *user.Summary
	AmountCents int64
	PaidAt      time.Time
}

type WallPage struct {
	Entries []WallEntry
	Total   int
}

type Stats struct {
	TotalSponsors    int
	TotalAmountCents int64
}

type ListFilter struct {
	Status *Status
}

type Page = paging.Page

func CentsFromAmount(amount float64) int64 {
	negative := amount < 0
	text := strconv.FormatFloat(math.Abs(amount), 'f', -1, 64)
	whole, fraction, _ := strings.Cut(text, ".")
	fraction += "000"
	cents, err := strconv.ParseInt(whole+fraction[:2], 10, 64)
	if err != nil {
		return int64(math.Round(amount * 100))
	}
	if fraction[2] >= '5' {
		cents++
	}
	if negative {
		return -cents
	}
	return cents
}

func Amount(cents int64) float64 {
	return float64(cents) / 100
}
