package ai

import (
	"context"
	"slices"
	"strconv"
	"time"
)

type ModelDeps struct {
	Gateway *Service
	Repo    Repository
	Stats   StatsStore
	Routes  *RouteService
	Catalog *CatalogService
	Tx      Transactor
	Now     func() time.Time
}

type ModelService struct {
	gateway *Service
	repo    Repository
	stats   StatsStore
	routes  *RouteService
	catalog *CatalogService
	tx      Transactor
	now     func() time.Time
}

func NewModelService(deps ModelDeps) *ModelService {
	return &ModelService{gateway: deps.Gateway, repo: deps.Repo, stats: deps.Stats, routes: deps.Routes, catalog: deps.Catalog, tx: deps.Tx, now: deps.Now}
}

func (s *ModelService) List(ctx context.Context) ([]ModelView, error) {
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	return s.views(ctx, models, RouteFilter{})
}

func (s *ModelService) Get(ctx context.Context, id int) (ModelView, error) {
	model, err := s.repo.GetModel(ctx, id)
	if err != nil {
		return ModelView{}, err
	}
	views, err := s.views(ctx, []Model{model}, RouteFilter{ModelID: &id})
	if err != nil {
		return ModelView{}, err
	}
	return views[0], nil
}

func (s *ModelService) Create(ctx context.Context, in ModelInput) (ModelView, error) {
	index, err := s.catalog.Index(ctx)
	if err != nil {
		return ModelView{}, err
	}
	official, ok := index.Official(in.CanonicalID)
	if !ok {
		return ModelView{}, ErrCatalogModelNotFound
	}
	seen := map[int]bool{}
	providers := make([]Provider, len(in.Routes))
	for i, route := range in.Routes {
		if seen[route.ProviderID] {
			return ModelView{}, ErrRouteOrderInvalid
		}
		seen[route.ProviderID] = true
		if providers[i], err = s.repo.GetProvider(ctx, route.ProviderID); err != nil {
			return ModelView{}, err
		}
	}
	existing, err := s.repo.ListModels(ctx)
	if err != nil {
		return ModelView{}, err
	}
	taken := map[string]bool{}
	for _, model := range existing {
		taken[model.Key] = true
		if model.CanonicalID != nil && *model.CanonicalID == in.CanonicalID {
			return ModelView{}, ErrModelTaken
		}
	}
	capabilities := official.Capabilities()
	canonical := in.CanonicalID
	var id int
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		id, err = s.repo.CreateModel(ctx, NewModel{Key: modelKey(canonical, taken), Name: in.Name, Description: in.Description, CanonicalID: &canonical, Capabilities: capabilities})
		if err != nil {
			return err
		}
		for priority, route := range in.Routes {
			provider := providers[priority]
			described, found := describe(index, priced(provider), UpstreamModel{ID: route.UpstreamID, Protocols: []Protocol{route.Protocol}})
			_, err := s.repo.CreateRoute(ctx, NewRoute{
				ModelID:    id,
				ProviderID: provider.ID,
				UpstreamID: route.UpstreamID,
				Protocol:   provider.Kind.ProtocolFor(route.Protocol, capabilities.Moderation),
				Price:      describedPrice(described, found),
				Priority:   priority,
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return ModelView{}, err
	}
	if _, err := s.catalog.Refresh(ctx); err != nil {
		return ModelView{}, err
	}
	return s.Get(ctx, id)
}

func (s *ModelService) Update(ctx context.Context, id int, update ModelUpdate) (ModelView, error) {
	current, err := s.repo.GetModel(ctx, id)
	if err != nil {
		return ModelView{}, err
	}
	canonical := current.CanonicalID
	if update.CanonicalID != nil {
		canonical = *update.CanonicalID
	}
	if update.Vision != nil && canonical != nil {
		return ModelView{}, ErrCatalogOwned
	}
	relinked := update.CanonicalID != nil && !sameString(*update.CanonicalID, current.CanonicalID)
	if relinked && canonical != nil {
		index, err := s.catalog.Index(ctx)
		if err != nil {
			return ModelView{}, err
		}
		if _, ok := index.Official(*canonical); !ok {
			return ModelView{}, ErrCatalogModelNotFound
		}
	}
	changes := ModelChanges{Name: update.Name, Description: update.Description, CanonicalID: update.CanonicalID, Enabled: update.Enabled, IsDefault: update.IsDefault}
	if update.Vision != nil {
		capabilities := current.Capabilities
		capabilities.Vision = *update.Vision
		changes.Capabilities = &capabilities
	}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if update.IsDefault != nil && *update.IsDefault {
			if err := s.repo.ClearDefaultModel(ctx, id); err != nil {
				return err
			}
		}
		return s.repo.UpdateModel(ctx, id, changes)
	})
	if err != nil {
		return ModelView{}, err
	}
	if relinked {
		if _, err := s.catalog.Refresh(ctx); err != nil {
			return ModelView{}, err
		}
	}
	return s.Get(ctx, id)
}

func (s *ModelService) Delete(ctx context.Context, id int) error {
	model, err := s.repo.GetModel(ctx, id)
	if err != nil {
		return err
	}
	if model.IsDefault {
		return ErrDefaultModelDelete
	}
	return s.repo.DeleteModel(ctx, id)
}

func (s *ModelService) Reorder(ctx context.Context, id int, routeIDs []int) (ModelView, error) {
	if _, err := s.repo.GetModel(ctx, id); err != nil {
		return ModelView{}, err
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{ModelID: &id})
	if err != nil {
		return ModelView{}, err
	}
	known := make([]int, len(routes))
	for i, route := range routes {
		known[i] = route.ID
	}
	requested := slices.Clone(routeIDs)
	slices.Sort(known)
	slices.Sort(requested)
	if !slices.Equal(known, requested) {
		return ModelView{}, ErrRouteOrderInvalid
	}
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		return s.repo.SetRoutePriorities(ctx, routeIDs)
	})
	if err != nil {
		return ModelView{}, err
	}
	return s.Get(ctx, id)
}

func (s *ModelService) AddRoute(ctx context.Context, id int, source RouteSource) (RouteView, error) {
	model, err := s.repo.GetModel(ctx, id)
	if err != nil {
		return RouteView{}, err
	}
	provider, err := s.repo.GetProvider(ctx, source.ProviderID)
	if err != nil {
		return RouteView{}, err
	}
	price := Price{Input: valueOr(source.InputPrice, 0), Output: valueOr(source.OutputPrice, 0)}
	if !source.PriceManual {
		index, err := s.catalog.Index(ctx)
		if err != nil {
			return RouteView{}, err
		}
		described, found := describe(index, priced(provider), UpstreamModel{ID: source.UpstreamID, Protocols: []Protocol{source.Protocol}})
		price = describedPrice(described, found)
	}
	var routeID int
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		priority, err := s.repo.NextRoutePriority(ctx, id)
		if err != nil {
			return err
		}
		routeID, err = s.repo.CreateRoute(ctx, NewRoute{
			ModelID:     id,
			ProviderID:  provider.ID,
			UpstreamID:  source.UpstreamID,
			Protocol:    provider.Kind.ProtocolFor(source.Protocol, model.Moderation),
			PriceManual: source.PriceManual,
			Price:       price,
			Priority:    priority,
		})
		return err
	})
	if err != nil {
		return RouteView{}, err
	}
	if !source.PriceManual {
		if _, err := s.catalog.Refresh(ctx); err != nil {
			return RouteView{}, err
		}
	}
	return s.routes.Get(ctx, routeID)
}

func (s *ModelService) views(ctx context.Context, models []Model, filter RouteFilter) ([]ModelView, error) {
	routes, err := s.repo.ListRoutes(ctx, filter)
	if err != nil {
		return nil, err
	}
	presented, err := s.routes.present(ctx, routes)
	if err != nil {
		return nil, err
	}
	configs, err := s.repo.ListSceneConfigs(ctx)
	if err != nil {
		return nil, err
	}
	stats, err := s.stats.Grouped(ctx, DimensionModel, s.now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	byModel := map[int][]RouteView{}
	for _, view := range presented {
		byModel[view.Model.ID] = append(byModel[view.Model.ID], view)
	}
	configured := map[string]SceneConfig{}
	for _, config := range configs {
		configured[config.Key] = config
	}
	views := make([]ModelView, len(models))
	for i, model := range models {
		view := ModelView{Model: model, RouteViews: byModel[model.ID], Stats: stats[strconv.Itoa(model.ID)], Scenes: []ModelScene{}}
		if view.RouteViews == nil {
			view.RouteViews = []RouteView{}
		}
		for _, definition := range s.gateway.Scenes() {
			config := configured[definition.Key]
			switch {
			case config.ModelID != nil && *config.ModelID == model.ID:
				view.Scenes = append(view.Scenes, ModelScene{Key: definition.Key, Label: definition.Label, Role: SceneRolePrimary})
			case config.ModelID == nil && model.IsDefault:
				view.Scenes = append(view.Scenes, ModelScene{Key: definition.Key, Label: definition.Label, Role: SceneRoleDefault})
			}
		}
		views[i] = view
	}
	return views, nil
}
