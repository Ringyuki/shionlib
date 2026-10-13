package sponsortest

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type MemoryRepository struct {
	mu       sync.Mutex
	now      func() time.Time
	nextID   int
	orders   map[int]sponsor.Order
	users    map[int]user.Summary
	profiles map[int]sponsor.WallSponsor
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	return &MemoryRepository{now: now, orders: map[int]sponsor.Order{}, users: map[int]user.Summary{}, profiles: map[int]sponsor.WallSponsor{}}
}

func (r *MemoryRepository) AddUser(summary user.Summary) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[summary.ID] = summary
}

func (r *MemoryRepository) Describe(id int, cover, bio string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.profiles[id] = sponsor.WallSponsor{Cover: &cover, Bio: &bio}
}

func (r *MemoryRepository) User(id int) (user.Summary, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	summary, ok := r.users[id]
	return summary, ok
}

func (r *MemoryRepository) Create(_ context.Context, in sponsor.NewOrder) (sponsor.Order, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	expires := in.ExpiresAt
	order := sponsor.Order{
		ID:              r.nextID,
		ProviderOrderID: in.ProviderOrderID,
		Provider:        in.Provider,
		AmountCents:     in.AmountCents,
		Status:          sponsor.StatusNew,
		SponsorName:     in.SponsorName,
		Message:         in.Message,
		IsPrivate:       in.IsPrivate,
		UserID:          in.UserID,
		ExpiresAt:       &expires,
		Created:         r.now(),
	}
	r.orders[order.ID] = order
	return r.withUser(order), nil
}

func (r *MemoryRepository) Seed(order sponsor.Order) sponsor.Order {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	order.ID = r.nextID
	if order.Status == "" {
		order.Status = sponsor.StatusNew
	}
	if order.Provider == "" {
		order.Provider = ProviderName
	}
	if order.Created.IsZero() {
		order.Created = r.now()
	}
	r.orders[order.ID] = order
	return r.withUser(order)
}

func (r *MemoryRepository) Get(_ context.Context, id int) (sponsor.Order, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	order, ok := r.orders[id]
	if !ok {
		return sponsor.Order{}, sponsor.ErrOrderNotFound
	}
	return r.withUser(order), nil
}

func (r *MemoryRepository) Lock(ctx context.Context, id int) (sponsor.Order, error) {
	return r.Get(ctx, id)
}

func (r *MemoryRepository) FindByProviderOrderID(_ context.Context, providerOrderID string) (sponsor.Order, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, order := range r.orders {
		if order.ProviderOrderID == providerOrderID {
			return r.withUser(order), nil
		}
	}
	return sponsor.Order{}, sponsor.ErrOrderNotFound
}

func (r *MemoryRepository) SetPaymentMethod(_ context.Context, id int, method string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	order, ok := r.orders[id]
	if !ok {
		return sponsor.ErrOrderNotFound
	}
	order.PaymentMethod = &method
	r.orders[id] = order
	return nil
}

func (r *MemoryRepository) ApplyStatus(_ context.Context, id int, change sponsor.StatusChange) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	order, ok := r.orders[id]
	if !ok {
		return sponsor.ErrOrderNotFound
	}
	order.Status = change.Status
	if change.PaidAt != nil {
		paid := *change.PaidAt
		order.PaidAt = &paid
	}
	if change.CallbackVerified {
		order.CallbackVerified = true
	}
	r.orders[id] = order
	return nil
}

func (r *MemoryRepository) Delete(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.orders[id]; !ok {
		return sponsor.ErrOrderNotFound
	}
	delete(r.orders, id)
	return nil
}

func (r *MemoryRepository) List(_ context.Context, filter sponsor.ListFilter, page sponsor.Page) ([]sponsor.Order, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var matched []sponsor.Order
	for _, order := range r.orders {
		if filter.Status != nil && order.Status != *filter.Status {
			continue
		}
		matched = append(matched, r.withUser(order))
	}
	slices.SortFunc(matched, func(a, b sponsor.Order) int {
		if c := b.Created.Compare(a.Created); c != 0 {
			return c
		}
		return cmp.Compare(b.ID, a.ID)
	})
	return paginate(matched, page), len(matched), nil
}

func (r *MemoryRepository) Wall(_ context.Context, page sponsor.Page) ([]sponsor.WallEntry, int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	latest := map[string]sponsor.Order{}
	for _, order := range r.orders {
		if order.Status != sponsor.StatusDone || order.IsPrivate || order.PaidAt == nil {
			continue
		}
		key := fmt.Sprintf("o%d", order.ID)
		if order.UserID != nil {
			key = fmt.Sprintf("u%d", *order.UserID)
		}
		if shown, ok := latest[key]; !ok || later(order, shown) {
			latest[key] = order
		}
	}
	matched := make([]sponsor.Order, 0, len(latest))
	for _, order := range latest {
		matched = append(matched, order)
	}
	slices.SortFunc(matched, func(a, b sponsor.Order) int {
		if later(a, b) {
			return -1
		}
		return 1
	})
	window := paginate(matched, page)
	entries := make([]sponsor.WallEntry, len(window))
	for i, order := range window {
		entry := sponsor.WallEntry{OrderID: order.ID, Message: order.Message, PaidAt: *order.PaidAt}
		if order.UserID == nil {
			entry.Name = order.SponsorName
		} else if summary, ok := r.users[*order.UserID]; ok {
			profile := r.profiles[*order.UserID]
			entry.Sponsor = &sponsor.WallSponsor{Summary: summary, Cover: profile.Cover, Bio: profile.Bio}
		}
		entries[i] = entry
	}
	return entries, len(matched), nil
}

func later(a, b sponsor.Order) bool {
	if c := a.PaidAt.Compare(*b.PaidAt); c != 0 {
		return c > 0
	}
	return a.ID > b.ID
}

func (r *MemoryRepository) Stats(_ context.Context) (sponsor.Stats, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var stats sponsor.Stats
	for _, order := range r.orders {
		if order.Status == sponsor.StatusDone {
			stats.TotalSponsors++
			stats.TotalAmountCents += order.AmountCents
		}
	}
	return stats, nil
}

func (r *MemoryRepository) PaidSince(_ context.Context, since time.Time) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var cents int64
	for _, order := range r.orders {
		if order.Status == sponsor.StatusDone && order.PaidAt != nil && !order.PaidAt.Before(since) {
			cents += order.AmountCents
		}
	}
	return cents, nil
}

func (r *MemoryRepository) ExpireStale(_ context.Context, now time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for id, order := range r.orders {
		if order.Status == sponsor.StatusNew && order.ExpiresAt != nil && order.ExpiresAt.Before(now) {
			order.Status = sponsor.StatusExpired
			r.orders[id] = order
			count++
		}
	}
	return count, nil
}

func (r *MemoryRepository) ExtendSponsorship(_ context.Context, userID int, by time.Duration, now time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	summary, ok := r.users[userID]
	if !ok {
		return nil
	}
	base := now
	if summary.SponsorExpiresAt != nil && summary.SponsorExpiresAt.After(now) {
		base = *summary.SponsorExpiresAt
	}
	until := base.Add(by)
	summary.SponsorExpiresAt = &until
	r.users[userID] = summary
	return nil
}

func (r *MemoryRepository) withUser(order sponsor.Order) sponsor.Order {
	order.User = nil
	if order.UserID != nil {
		if summary, ok := r.users[*order.UserID]; ok {
			order.User = &summary
		}
	}
	return order
}

func paginate[T any](items []T, page sponsor.Page) []T {
	start := min(page.Offset(), len(items))
	end := min(start+page.Size, len(items))
	return slices.Clone(items[start:end])
}
