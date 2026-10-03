package sponsor

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo     Repository
	provider Provider
	cache    Cache
	tx       Transactor
	signer   Signer
	settings Settings
	now      func() time.Time
}

func NewService(repo Repository, provider Provider, cache Cache, tx Transactor, signer Signer, settings Settings, now func() time.Time) *Service {
	return &Service{repo: repo, provider: provider, cache: cache, tx: tx, signer: signer, settings: settings, now: now}
}

type CreateOrderInput struct {
	AmountCents int64
	IsPrivate   bool
	Name        string
	Message     string
}

func (s *Service) CreateOrder(ctx context.Context, who actor.Actor, in CreateOrderInput) (CreatedOrder, error) {
	if !s.settings.Enabled {
		return CreatedOrder{}, ErrDisabled
	}
	providerOrderID, err := s.provider.CreateOrder(ctx, ProviderOrderRequest(in))
	if err != nil {
		return CreatedOrder{}, err
	}
	info, err := s.provider.OrderInfo(ctx, providerOrderID)
	if err != nil {
		return CreatedOrder{}, err
	}
	expiresAt := s.now().Add(FallbackOrderLifetime)
	if info.ExpiresAt != nil {
		expiresAt = *info.ExpiresAt
	}
	var userID *int
	if who.Authenticated() {
		id := who.UserID
		userID = &id
	}
	order, err := s.repo.Create(ctx, NewOrder{
		ProviderOrderID: providerOrderID,
		Provider:        s.settings.Provider,
		AmountCents:     in.AmountCents,
		SponsorName:     nonEmpty(in.Name),
		Message:         nonEmpty(in.Message),
		IsPrivate:       in.IsPrivate,
		UserID:          userID,
		ExpiresAt:       expiresAt,
	})
	if err != nil {
		return CreatedOrder{}, err
	}
	return CreatedOrder{
		OrderID:         order.ID,
		ProviderOrderID: providerOrderID,
		PaymentMethods:  info.PaymentMethods,
		ExpiresAt:       info.ExpiresAt,
		AccessToken:     s.signer.Sign(accessMessage(order)),
	}, nil
}

type PayInput struct {
	Method      string
	RedirectURL *string
}

func (s *Service) PayOrder(ctx context.Context, id int, in PayInput) (Payment, error) {
	if !s.settings.Enabled {
		return Payment{}, ErrDisabled
	}
	order, err := s.repo.Get(ctx, id)
	if err != nil {
		return Payment{}, err
	}
	switch order.Status {
	case StatusDone:
		return Payment{}, ErrOrderAlreadyPaid
	case StatusExpired:
		return Payment{}, ErrOrderExpired
	}
	payment, err := s.provider.PayOrder(ctx, PaymentRequest{
		ProviderOrderID: order.ProviderOrderID,
		Method:          in.Method,
		RedirectURL:     in.RedirectURL,
		CallbackURL:     s.settings.CallbackURL,
	})
	if err != nil {
		return Payment{}, err
	}
	if err := s.repo.SetPaymentMethod(ctx, id, in.Method); err != nil {
		return Payment{}, err
	}
	return payment, nil
}

func (s *Service) Order(ctx context.Context, viewer actor.Actor, id int, accessToken string) (OrderView, error) {
	order, err := s.repo.Get(ctx, id)
	if err != nil {
		return OrderView{}, err
	}
	if !order.OwnedBy(viewer) && !s.validAccessToken(order, accessToken) {
		return OrderView{Order: order.redacted()}, nil
	}
	synced, err := s.syncPending(ctx, order)
	if err != nil {
		return OrderView{}, err
	}
	return OrderView{Order: synced, Full: true}, nil
}

func (s *Service) AdminOrder(ctx context.Context, id int) (Order, error) {
	order, err := s.repo.Get(ctx, id)
	if err != nil {
		return Order{}, err
	}
	return s.syncPending(ctx, order)
}

func (s *Service) HandleCallback(ctx context.Context, providerOrderID string) error {
	order, err := s.repo.FindByProviderOrderID(ctx, providerOrderID)
	if err != nil {
		return err
	}
	if order.Status == StatusDone {
		return nil
	}
	info, err := s.provider.OrderInfo(ctx, providerOrderID)
	if err != nil {
		return err
	}
	if !info.matches(order) {
		return ErrProviderVerificationFailed.Wrap(fmt.Errorf("provider order %q does not match local order %d", info.ID, order.ID))
	}
	if info.Status != StatusDone && info.Status != StatusRefund {
		return nil
	}
	_, err = s.transition(ctx, order.ID, info.Status, fromCallback)
	return err
}

func (s *Service) AdminUpdateStatus(ctx context.Context, id int, status Status) error {
	_, err := s.transition(ctx, id, status, fromAdmin)
	return err
}

func (s *Service) AdminDelete(ctx context.Context, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		order, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if err := s.repo.Delete(ctx, id); err != nil {
			return err
		}
		if order.Status == StatusDone {
			s.tx.AfterCommit(ctx, s.invalidateWall)
		}
		return nil
	})
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]Order, int, error) {
	return s.repo.List(ctx, filter, page)
}

func (s *Service) Wall(ctx context.Context, page Page) (WallPage, error) {
	key := fmt.Sprintf("%sp%d:ps%d", WallCachePrefix, page.Number, page.Size)
	var cached WallPage
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	entries, total, err := s.repo.Wall(ctx, page)
	if err != nil {
		return WallPage{}, err
	}
	result := WallPage{Entries: entries, Total: total}
	_ = s.cache.Set(ctx, key, result, WallCacheTTL)
	return result, nil
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	return s.repo.Stats(ctx)
}

func (s *Service) ExpireStaleOrders(ctx context.Context) error {
	_, err := s.repo.ExpireStale(ctx, s.now())
	return err
}

type transitionSource int

const (
	fromPoll transitionSource = iota
	fromCallback
	fromAdmin
)

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

func (s *Service) transition(ctx context.Context, id int, target Status, source transitionSource) (bool, error) {
	changed := false
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if !source.allows(current.Status, target) {
			return nil
		}
		now := s.now()
		change := StatusChange{Status: target, CallbackVerified: source == fromCallback}
		if target == StatusDone && (source != fromAdmin || current.PaidAt == nil) {
			change.PaidAt = &now
		}
		if err := s.repo.ApplyStatus(ctx, id, change); err != nil {
			return err
		}
		if target == StatusDone && current.Status != StatusDone && current.UserID != nil {
			if extension := sponsorshipFor(current.AmountCents); extension > 0 {
				if err := s.repo.ExtendSponsorship(ctx, *current.UserID, extension, now); err != nil {
					return err
				}
			}
		}
		if target == StatusDone || current.Status == StatusDone {
			s.tx.AfterCommit(ctx, s.invalidateWall)
		}
		changed = true
		return nil
	})
	return changed, err
}

func (s *Service) syncPending(ctx context.Context, order Order) (Order, error) {
	if order.Status != StatusNew {
		return order, nil
	}
	info, ok := s.providerOrder(ctx, order.ProviderOrderID)
	if !ok || info.Status == StatusNew || !info.Status.Valid() || !info.matches(order) {
		return order, nil
	}
	changed, err := s.transition(ctx, order.ID, info.Status, fromPoll)
	if err != nil {
		return Order{}, err
	}
	if !changed {
		return order, nil
	}
	return s.repo.Get(ctx, order.ID)
}

func (s *Service) providerOrder(ctx context.Context, providerOrderID string) (ProviderOrder, bool) {
	info, err := s.provider.OrderInfo(ctx, providerOrderID)
	return info, err == nil
}

func (s *Service) validAccessToken(order Order, token string) bool {
	return token != "" && s.signer.Verify(accessMessage(order), token)
}

func (s *Service) invalidateWall(ctx context.Context) {
	_ = s.cache.DeletePrefix(ctx, WallCachePrefix)
}

func accessMessage(order Order) string {
	return fmt.Sprintf("sponsor-order:%d:%s", order.ID, order.ProviderOrderID)
}

func nonEmpty(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
