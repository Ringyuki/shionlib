package sponsor

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Service struct {
	repo     Repository
	provider Provider
	tx       Transactor
	signer   Signer
	settings setting.Source
	options  Options
	now      func() time.Time
}

func NewService(repo Repository, provider Provider, tx Transactor, signer Signer, settings setting.Source, options Options, now func() time.Time) *Service {
	return &Service{repo: repo, provider: provider, tx: tx, signer: signer, settings: settings, options: options, now: now}
}

func (s *Service) CreateOrder(ctx context.Context, who actor.Actor, in CreateOrderInput) (CreatedOrder, error) {
	if !Enabled.Read(s.settings) {
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
		Provider:        s.options.Provider,
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

func (s *Service) PayOrder(ctx context.Context, id int, in PayInput) (Payment, error) {
	if !Enabled.Read(s.settings) {
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
		CallbackURL:     s.options.CallbackURL,
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
	synced, methods, err := s.syncPending(ctx, order)
	if err != nil {
		return OrderView{}, err
	}
	return OrderView{Order: synced, Full: true, PaymentMethods: methods}, nil
}

func (s *Service) AdminOrder(ctx context.Context, id int) (Order, error) {
	order, err := s.repo.Get(ctx, id)
	if err != nil {
		return Order{}, err
	}
	synced, _, err := s.syncPending(ctx, order)
	return synced, err
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
		if _, err := s.repo.Lock(ctx, id); err != nil {
			return err
		}
		return s.repo.Delete(ctx, id)
	})
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]Order, int, error) {
	return s.repo.List(ctx, filter, page)
}

func (s *Service) Wall(ctx context.Context, page Page) (WallPage, error) {
	entries, total, err := s.repo.Wall(ctx, page)
	if err != nil {
		return WallPage{}, err
	}
	return WallPage{Entries: entries, Total: total}, nil
}

func (s *Service) State() State {
	return State{Enabled: Enabled.Read(s.settings), BadgeDaysPerDollar: DaysPerDollar}
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	return s.repo.Stats(ctx)
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	totals, err := s.repo.Stats(ctx)
	if err != nil {
		return Overview{}, err
	}
	month, err := s.repo.PaidSince(ctx, monthStart(s.now(), s.options.ClockOffset))
	if err != nil {
		return Overview{}, err
	}
	return Overview{Totals: totals, MonthAmountCents: month, Enabled: Enabled.Read(s.settings)}, nil
}

func (s *Service) ExpireStaleOrders(ctx context.Context) error {
	_, err := s.repo.ExpireStale(ctx, s.now())
	return err
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
		changed = true
		return nil
	})
	return changed, err
}

func (s *Service) syncPending(ctx context.Context, order Order) (Order, []PaymentMethod, error) {
	if order.Status != StatusNew {
		return order, nil, nil
	}
	info, ok := s.providerOrder(ctx, order.ProviderOrderID)
	if !ok {
		return order, nil, nil
	}
	if info.Status == StatusNew || !info.Status.Valid() || !info.matches(order) {
		return order, info.PaymentMethods, nil
	}
	changed, err := s.transition(ctx, order.ID, info.Status, fromPoll)
	if err != nil {
		return Order{}, nil, err
	}
	if !changed {
		return order, info.PaymentMethods, nil
	}
	synced, err := s.repo.Get(ctx, order.ID)
	return synced, nil, err
}

func (s *Service) providerOrder(ctx context.Context, providerOrderID string) (ProviderOrder, bool) {
	info, err := s.provider.OrderInfo(ctx, providerOrderID)
	return info, err == nil
}

func (s *Service) validAccessToken(order Order, token string) bool {
	return token != "" && s.signer.Verify(accessMessage(order), token)
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

func sponsorshipFor(amountCents int64) time.Duration {
	days := amountCents * DaysPerDollar / 100
	return time.Duration(days) * 24 * time.Hour
}

type Options struct {
	Provider    string
	CallbackURL string
	ClockOffset time.Duration
}
