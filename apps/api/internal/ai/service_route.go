package ai

import (
	"context"
	"slices"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

type RouteDeps struct {
	Repo    Repository
	Stats   StatsStore
	Catalog *CatalogService
	Probe   *ProbeService
	Tx      Transactor
	Now     func() time.Time
}

type RouteService struct {
	repo    Repository
	stats   StatsStore
	catalog *CatalogService
	probe   *ProbeService
	tx      Transactor
	now     func() time.Time
}

func NewRouteService(deps RouteDeps) *RouteService {
	return &RouteService{repo: deps.Repo, stats: deps.Stats, catalog: deps.Catalog, probe: deps.Probe, tx: deps.Tx, now: deps.Now}
}

func (s *RouteService) Get(ctx context.Context, id int) (RouteView, error) {
	route, err := s.repo.GetRoute(ctx, id)
	if err != nil {
		return RouteView{}, err
	}
	views, err := s.present(ctx, []Route{route})
	if err != nil {
		return RouteView{}, err
	}
	return views[0], nil
}

func (s *RouteService) Update(ctx context.Context, id int, update RouteUpdate) (RouteView, error) {
	route, err := s.repo.GetRoute(ctx, id)
	if err != nil {
		return RouteView{}, err
	}
	if update.Status != nil && *update.Status != RouteActive && *update.Status != RouteDisabled {
		return RouteView{}, apperror.ErrValidationFailed.New().WithField("status", "status must be active or disabled")
	}
	changes := RouteChanges{UpstreamID: update.UpstreamID, PriceManual: update.PriceManual}
	switched := false
	if update.Protocol != nil {
		if !routeProtocolAllowed(route.Provider.Kind, *update.Protocol, route.Model.Moderation) {
			return RouteView{}, ErrProtocolUnsupported
		}
		changes.Protocol = update.Protocol
		switched = *update.Protocol != route.Protocol
	}
	if update.InputPrice != nil || update.OutputPrice != nil {
		price := route.Price
		price.Input = valueOr(update.InputPrice, price.Input)
		price.Output = valueOr(update.OutputPrice, price.Output)
		changes.Price = &price
	}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.UpdateRoute(ctx, id, changes); err != nil {
			return err
		}
		if switched {
			if err := s.repo.DeleteAdjustmentsOfKind(ctx, id, AdjustProtocol); err != nil {
				return err
			}
		}
		if update.Status != nil {
			if _, err := s.repo.SetRouteStatus(ctx, []int{id}, *update.Status, s.now()); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return RouteView{}, err
	}
	if (update.PriceManual != nil && !*update.PriceManual) || update.UpstreamID != nil {
		if _, err := s.catalog.Refresh(ctx); err != nil {
			return RouteView{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s *RouteService) Delete(ctx context.Context, id int) error {
	deleted, err := s.repo.DeleteRoutes(ctx, []int{id})
	if err != nil {
		return err
	}
	if deleted == 0 {
		return ErrRouteNotFound
	}
	return nil
}

func (s *RouteService) Batch(ctx context.Context, ids []int, action RouteBatchAction) (int, error) {
	switch action {
	case BatchDelete:
		return s.repo.DeleteRoutes(ctx, ids)
	case BatchEnable:
		return s.repo.SetRouteStatus(ctx, ids, RouteActive, s.now())
	case BatchDisable:
		return s.repo.SetRouteStatus(ctx, ids, RouteDisabled, s.now())
	}
	return 0, apperror.ErrValidationFailed.New().WithField("action", "unknown batch action")
}

func (s *RouteService) RevertAdjustment(ctx context.Context, routeID, adjustmentID int) (RouteView, error) {
	route, err := s.repo.GetRoute(ctx, routeID)
	if err != nil {
		return RouteView{}, err
	}
	index := slices.IndexFunc(route.Adjustments, func(adjustment Adjustment) bool { return adjustment.ID == adjustmentID })
	if index < 0 {
		return RouteView{}, ErrAdjustmentNotFound
	}
	adjustment := route.Adjustments[index]
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.UpdateRoute(ctx, routeID, revertAdjustment(route, adjustment)); err != nil {
			return err
		}
		if adjustment.Kind == AdjustProtocol {
			return s.repo.DeleteAdjustmentsOfKind(ctx, routeID, AdjustProtocol)
		}
		return s.repo.DeleteAdjustment(ctx, routeID, adjustmentID)
	})
	if err != nil {
		return RouteView{}, err
	}
	return s.Get(ctx, routeID)
}

func (s *RouteService) Check(ctx context.Context, id int) (CheckResult, error) {
	if _, err := s.repo.GetRoute(ctx, id); err != nil {
		return CheckResult{}, err
	}
	failure, err := s.probe.Check(ctx, id)
	if err != nil {
		return CheckResult{}, err
	}
	view, err := s.Get(ctx, id)
	if err != nil {
		return CheckResult{}, err
	}
	return CheckResult{Failure: failure, Route: view}, nil
}

func (s *RouteService) present(ctx context.Context, routes []Route) ([]RouteView, error) {
	if len(routes) == 0 {
		return []RouteView{}, nil
	}
	ids := make([]int, len(routes))
	providerIDs := make([]int, 0, len(routes))
	for i, route := range routes {
		ids[i] = route.ID
		providerIDs = append(providerIDs, route.Provider.ID)
	}
	slices.Sort(providerIDs)
	providerIDs = slices.Compact(providerIDs)
	stats, err := s.stats.Grouped(ctx, DimensionRoute, s.now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	latest, err := s.stats.LatestAttempts(ctx, ids)
	if err != nil {
		return nil, err
	}
	offers, err := s.repo.ListOffers(ctx, OfferFilter{ProviderIDs: providerIDs})
	if err != nil {
		return nil, err
	}
	synced, offered := map[int]bool{}, map[string]bool{}
	for _, offer := range offers {
		synced[offer.ProviderID] = true
		offered[offerKey(offer.ProviderID, offer.UpstreamID)] = true
	}
	views := make([]RouteView, len(routes))
	for i, route := range routes {
		view := RouteView{Route: route, Stats: stats[strconv.Itoa(route.ID)]}
		if synced[route.Provider.ID] {
			listed := offered[offerKey(route.Provider.ID, route.UpstreamID)]
			view.Offered = &listed
		}
		if last, ok := latest[route.ID]; ok {
			view.Last = &last
		}
		views[i] = view
	}
	return views, nil
}

func routeProtocolAllowed(kind ProviderKind, protocol Protocol, moderation bool) bool {
	return kind.Supports(protocol) && (protocol == ProtocolModeration) == moderation
}
