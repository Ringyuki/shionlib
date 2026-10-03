package ai

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"strconv"
	"time"
)

type ProviderDeps struct {
	Repo     Repository
	Stats    StatsStore
	Routes   *RouteService
	Catalog  *CatalogService
	Upstream Upstream
	Tx       Transactor
	Now      func() time.Time
}

type ProviderService struct {
	repo     Repository
	stats    StatsStore
	routes   *RouteService
	catalog  *CatalogService
	upstream Upstream
	tx       Transactor
	now      func() time.Time
}

func NewProviderService(deps ProviderDeps) *ProviderService {
	return &ProviderService{repo: deps.Repo, stats: deps.Stats, routes: deps.Routes, catalog: deps.Catalog, upstream: deps.Upstream, tx: deps.Tx, now: deps.Now}
}

func (s *ProviderService) List(ctx context.Context) ([]ProviderView, error) {
	summaries, err := s.repo.ListProviders(ctx)
	if err != nil {
		return nil, err
	}
	stats, err := s.stats.Grouped(ctx, DimensionProvider, s.now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	used, err := s.stats.LastUsed(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]ProviderView, len(summaries))
	for i, summary := range summaries {
		views[i] = ProviderView{ProviderSummary: summary, Stats: stats[strconv.Itoa(summary.ID)]}
		if at, ok := used[summary.ID]; ok {
			views[i].LastUsed = &at
		}
	}
	return views, nil
}

func (s *ProviderService) Get(ctx context.Context, id int) (ProviderDetail, error) {
	views, err := s.List(ctx)
	if err != nil {
		return ProviderDetail{}, err
	}
	index := slices.IndexFunc(views, func(view ProviderView) bool { return view.ID == id })
	if index < 0 {
		return ProviderDetail{}, ErrProviderNotFound
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ProviderID: &id})
	if err != nil {
		return ProviderDetail{}, err
	}
	slices.SortStableFunc(routes, func(a, b Route) int {
		return cmp.Or(cmp.Compare(a.Model.Name, b.Model.Name), cmp.Compare(a.ID, b.ID))
	})
	presented, err := s.routes.present(ctx, routes)
	if err != nil {
		return ProviderDetail{}, err
	}
	return ProviderDetail{ProviderView: views[index], RouteViews: presented}, nil
}

func (s *ProviderService) Create(ctx context.Context, in ProviderInput) (ProviderDetail, error) {
	baseURL := normalizeBaseURL(in.BaseURL)
	if in.Kind.RequiresBaseURL() && baseURL == nil {
		return ProviderDetail{}, ErrBaseURLRequired
	}
	if err := s.checkName(ctx, in.Name, 0); err != nil {
		return ProviderDetail{}, err
	}
	if err := s.checkCatalogProvider(ctx, in.CatalogProviderID); err != nil {
		return ProviderDetail{}, err
	}
	id, err := s.repo.CreateProvider(ctx, NewProvider{
		Name:              in.Name,
		Kind:              in.Kind,
		BaseURL:           baseURL,
		APIKey:            in.APIKey,
		PriceMultiplier:   valueOr(in.PriceMultiplier, 1),
		CatalogProviderID: in.CatalogProviderID,
	})
	if err != nil {
		return ProviderDetail{}, err
	}
	return s.Get(ctx, id)
}

func (s *ProviderService) Update(ctx context.Context, id int, update ProviderUpdate) (ProviderDetail, error) {
	current, err := s.repo.GetProvider(ctx, id)
	if err != nil {
		return ProviderDetail{}, err
	}
	kind := valueOr(update.Kind, current.Kind)
	baseURL := current.BaseURL
	changes := ProviderChanges{Name: update.Name, Kind: update.Kind, APIKey: update.APIKey, PriceMultiplier: update.PriceMultiplier, CatalogProviderID: update.CatalogProviderID, Enabled: update.Enabled}
	if update.BaseURL != nil {
		baseURL = normalizeBaseURL(*update.BaseURL)
		changes.BaseURL = &baseURL
	}
	if kind.RequiresBaseURL() && baseURL == nil {
		return ProviderDetail{}, ErrBaseURLRequired
	}
	if update.Name != nil && *update.Name != current.Name {
		if err := s.checkName(ctx, *update.Name, id); err != nil {
			return ProviderDetail{}, err
		}
	}
	if update.CatalogProviderID != nil {
		if err := s.checkCatalogProvider(ctx, *update.CatalogProviderID); err != nil {
			return ProviderDetail{}, err
		}
	}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.repo.UpdateProvider(ctx, id, changes); err != nil {
			return err
		}
		if kind == current.Kind {
			return nil
		}
		return s.realignProtocols(ctx, id, kind)
	})
	if err != nil {
		return ProviderDetail{}, err
	}
	repriced := update.CatalogProviderID != nil || (update.PriceMultiplier != nil && !nearly(*update.PriceMultiplier, current.PriceMultiplier))
	if repriced {
		if _, err := s.catalog.Refresh(ctx); err != nil {
			return ProviderDetail{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s *ProviderService) Delete(ctx context.Context, id int) error {
	if _, err := s.repo.GetProvider(ctx, id); err != nil {
		return err
	}
	return s.repo.DeleteProvider(ctx, id)
}

func (s *ProviderService) Discover(ctx context.Context, id int) (Discovery, error) {
	provider, err := s.repo.GetProvider(ctx, id)
	if err != nil {
		return Discovery{}, err
	}
	connection, err := s.repo.ProviderConnection(ctx, id)
	if err != nil {
		return Discovery{}, err
	}
	listed, err := s.upstream.ListModels(ctx, connection)
	var failure *Failure
	if errors.As(err, &failure) {
		return Discovery{Failure: failure, Models: []DiscoveredOffer{}}, nil
	}
	if err != nil {
		return Discovery{}, err
	}
	index, err := s.catalog.Index(ctx)
	if err != nil {
		return Discovery{}, err
	}
	var described []DiscoveredModel
	for _, upstream := range listed {
		if model, ok := describe(index, priced(provider), upstream); ok {
			described = append(described, model)
		}
	}
	sortDiscovered(described)
	syncedAt := s.now()
	offers := make([]Offer, len(described))
	for i, model := range described {
		name := model.Name
		offers[i] = Offer{ProviderID: id, UpstreamID: model.UpstreamID, Name: &name, Protocols: model.Protocols, CanonicalID: model.CanonicalID, SyncedAt: syncedAt}
	}
	if err := s.repo.ReplaceOffers(ctx, id, offers); err != nil {
		return Discovery{}, err
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ProviderID: &id})
	if err != nil {
		return Discovery{}, err
	}
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return Discovery{}, err
	}
	discovery := Discovery{Models: make([]DiscoveredOffer, len(described))}
	for i, model := range described {
		offer := DiscoveredOffer{DiscoveredModel: model}
		if route, ok := routeFor(routes, model.UpstreamID); ok {
			routeID, modelID := route.ID, route.Model.ID
			offer.RouteID, offer.ModelID = &routeID, &modelID
		} else if match, ok := matchModel(models, model.CanonicalID, model.UpstreamID); ok {
			modelID := match.ID
			offer.ModelID = &modelID
		}
		discovery.Models[i] = offer
	}
	return discovery, nil
}

func (s *ProviderService) SyncOffers(ctx context.Context) error {
	ids, err := s.repo.EnabledProviderIDs(ctx)
	if err != nil {
		return err
	}
	var errs []error
	for _, id := range ids {
		if _, err := s.Discover(ctx, id); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *ProviderService) Resolve(ctx context.Context, id int, upstreamIDs []string) ([]ResolvedModel, error) {
	provider, err := s.repo.GetProvider(ctx, id)
	if err != nil {
		return nil, err
	}
	index, err := s.catalog.Index(ctx)
	if err != nil {
		return nil, err
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ProviderID: &id})
	if err != nil {
		return nil, err
	}
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	resolved := make([]ResolvedModel, len(upstreamIDs))
	for i, upstreamID := range upstreamIDs {
		item := ResolvedModel{UpstreamID: upstreamID}
		if described, ok := describe(index, priced(provider), UpstreamModel{ID: upstreamID}); ok && described.CanonicalID != nil {
			item.CanonicalID = described.CanonicalID
			if official, ok := index.Official(*described.CanonicalID); ok {
				name := official.Name
				item.CatalogName = &name
			}
		}
		if route, ok := routeFor(routes, upstreamID); ok {
			modelID, name := route.Model.ID, route.Model.Name
			item.ModelID, item.ModelName = &modelID, &name
		} else if match, ok := matchModel(models, item.CanonicalID, upstreamID); ok {
			modelID, name := match.ID, match.Name
			item.ModelID, item.ModelName = &modelID, &name
		}
		resolved[i] = item
	}
	return resolved, nil
}

func (s *ProviderService) AddRoutes(ctx context.Context, id int, items []RouteItem) (AddRoutesResult, error) {
	provider, err := s.repo.GetProvider(ctx, id)
	if err != nil {
		return AddRoutesResult{}, err
	}
	var upstreamIDs []string
	requested := map[string]Protocol{}
	for _, item := range items {
		if _, seen := requested[item.UpstreamID]; !seen {
			upstreamIDs = append(upstreamIDs, item.UpstreamID)
			requested[item.UpstreamID] = item.Protocol
		}
	}
	index, err := s.catalog.Index(ctx)
	if err != nil {
		return AddRoutesResult{}, err
	}
	offers, err := s.repo.ListOffers(ctx, OfferFilter{ProviderIDs: []int{id}, UpstreamIDs: upstreamIDs})
	if err != nil {
		return AddRoutesResult{}, err
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ProviderID: &id})
	if err != nil {
		return AddRoutesResult{}, err
	}
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return AddRoutesResult{}, err
	}
	present, covered, taken, canonicals := map[string]bool{}, map[int]bool{}, map[string]bool{}, map[string]bool{}
	for _, route := range routes {
		present[route.UpstreamID] = true
		covered[route.Model.ID] = true
	}
	for _, model := range models {
		taken[model.Key] = true
		if model.CanonicalID != nil {
			canonicals[*model.CanonicalID] = true
		}
	}
	result := AddRoutesResult{RouteIDs: []int{}, Skipped: []string{}}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		for _, upstreamID := range upstreamIDs {
			upstream := UpstreamModel{ID: upstreamID}
			if offer, ok := offerFor(offers, upstreamID); ok {
				upstream.Name, upstream.Protocols = offer.Name, nilIfEmpty(offer.Protocols)
			}
			described, found := describe(index, priced(provider), upstream)
			model, matched := matchModel(models, described.CanonicalID, upstreamID)
			if present[upstreamID] || (matched && covered[model.ID]) {
				result.Skipped = append(result.Skipped, upstreamID)
				continue
			}
			if !matched {
				created, err := s.createDiscoveredModel(ctx, upstreamID, described, found, taken, canonicals)
				if err != nil {
					return err
				}
				model = created
				models = append(models, created)
			}
			priority, err := s.repo.NextRoutePriority(ctx, model.ID)
			if err != nil {
				return err
			}
			routeID, err := s.repo.CreateRoute(ctx, NewRoute{
				ModelID:    model.ID,
				ProviderID: id,
				UpstreamID: upstreamID,
				Protocol:   provider.Kind.ProtocolFor(requested[upstreamID], model.Moderation),
				Price:      describedPrice(described, found),
				Priority:   priority,
			})
			if err != nil {
				return err
			}
			covered[model.ID] = true
			result.RouteIDs = append(result.RouteIDs, routeID)
		}
		return nil
	})
	if err != nil {
		return AddRoutesResult{}, err
	}
	if len(result.RouteIDs) > 0 {
		if _, err := s.catalog.Refresh(ctx); err != nil {
			return AddRoutesResult{}, err
		}
	}
	return result, nil
}

func (s *ProviderService) Endpoint(kind ProviderKind, baseURL *string) *string {
	normalized := normalizeBaseURL(baseURL)
	if kind.RequiresBaseURL() && normalized == nil {
		return nil
	}
	url := s.upstream.Endpoint(RouteTarget{Connection: Connection{Kind: kind, BaseURL: normalized}, UpstreamID: "model", Protocol: kind.Protocols()[0]})
	return &url
}

func (s *ProviderService) createDiscoveredModel(ctx context.Context, upstreamID string, described DiscoveredModel, found bool, taken, canonicals map[string]bool) (Model, error) {
	in := NewModel{Name: upstreamID, Capabilities: Capabilities{Temperature: true, Moderation: isModerationModel(upstreamID)}}
	source := upstreamID
	if found {
		in.Name, in.Capabilities = described.Name, described.Capabilities
		if described.CanonicalID != nil {
			source = *described.CanonicalID
			if !canonicals[source] {
				canonicals[source] = true
				in.CanonicalID = described.CanonicalID
			}
		}
	}
	in.Key = modelKey(source, taken)
	id, err := s.repo.CreateModel(ctx, in)
	if err != nil {
		return Model{}, err
	}
	return Model{ID: id, Key: in.Key, Name: in.Name, CanonicalID: in.CanonicalID, Capabilities: in.Capabilities, Enabled: true}, nil
}

func (s *ProviderService) realignProtocols(ctx context.Context, id int, kind ProviderKind) error {
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ProviderID: &id})
	if err != nil {
		return err
	}
	for _, route := range routes {
		protocol := kind.ProtocolFor(route.Protocol, route.Model.Moderation)
		if protocol == route.Protocol {
			continue
		}
		if err := s.repo.UpdateRoute(ctx, route.ID, RouteChanges{Protocol: &protocol}); err != nil {
			return err
		}
		if err := s.repo.DeleteAdjustmentsOfKind(ctx, route.ID, AdjustProtocol); err != nil {
			return err
		}
	}
	return nil
}

func (s *ProviderService) checkName(ctx context.Context, name string, exceptID int) error {
	taken, err := s.repo.ProviderNameTaken(ctx, name, exceptID)
	if err != nil {
		return err
	}
	if taken {
		return ErrProviderNameTaken
	}
	return nil
}

func (s *ProviderService) checkCatalogProvider(ctx context.Context, id *string) error {
	if id == nil {
		return nil
	}
	exists, err := s.catalog.ProviderExists(ctx, *id)
	if err != nil {
		return err
	}
	if !exists {
		return ErrCatalogProviderNotFound
	}
	return nil
}
