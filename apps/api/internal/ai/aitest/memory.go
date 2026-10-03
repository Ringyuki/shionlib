package aitest

import (
	"cmp"
	"context"
	"slices"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type storedProvider struct {
	provider ai.Provider
	key      string
}

type storedRoute struct {
	id            int
	modelID       int
	providerID    int
	upstreamID    string
	protocol      ai.Protocol
	priceManual   bool
	price         ai.Price
	droppedParams []string
	jsonMode      bool
	priority      int
	status        ai.RouteStatus
	statusKind    *ai.ErrorKind
	statusMessage *string
	statusAt      *time.Time
	created       time.Time
	updated       time.Time
}

type storedAdjustment struct {
	routeID    int
	adjustment ai.Adjustment
}

type MemoryRepository struct {
	mu             sync.Mutex
	now            func() time.Time
	nextProvider   int
	nextModel      int
	nextRoute      int
	nextAdjustment int
	nextUser       int
	providers      map[int]*storedProvider
	models         map[int]*ai.Model
	routes         map[int]*storedRoute
	adjustments    map[int]*storedAdjustment
	offers         map[int][]ai.Offer
	scenes         map[string]ai.SceneConfig
	superAdmins    []int
}

func NewMemoryRepository(now func() time.Time) *MemoryRepository {
	if now == nil {
		now = time.Now
	}
	return &MemoryRepository{
		now:         now,
		providers:   map[int]*storedProvider{},
		models:      map[int]*ai.Model{},
		routes:      map[int]*storedRoute{},
		adjustments: map[int]*storedAdjustment{},
		offers:      map[int][]ai.Offer{},
		scenes:      map[string]ai.SceneConfig{},
	}
}

func (r *MemoryRepository) AddSuperAdmin() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextUser++
	r.superAdmins = append(r.superAdmins, r.nextUser)
	return r.nextUser
}

func (r *MemoryRepository) clock() time.Time {
	return r.now().UTC()
}

func keyHint(key string) string {
	runes := []rune(key)
	if len(runes) <= 12 {
		return "…"
	}
	return string(runes[:3]) + "…" + string(runes[len(runes)-4:])
}

func clip(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func sortedKeys[K cmp.Ordered, V any](items map[K]V) []K {
	keys := make([]K, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

func (r *MemoryRepository) ListProviders(context.Context) ([]ai.ProviderSummary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	summaries := []ai.ProviderSummary{}
	for _, id := range sortedKeys(r.providers) {
		summary := ai.ProviderSummary{Provider: r.providers[id].provider, SuspendedKinds: []ai.ErrorKind{}, UpstreamIDs: []string{}}
		for _, routeID := range sortedKeys(r.routes) {
			route := r.routes[routeID]
			if route.providerID != id {
				continue
			}
			summary.Routes.Total++
			summary.UpstreamIDs = append(summary.UpstreamIDs, route.upstreamID)
			switch route.status {
			case ai.RouteActive:
				summary.Routes.Active++
			case ai.RouteDisabled:
				summary.Routes.Disabled++
			case ai.RouteSuspended:
				summary.Routes.Suspended++
				if route.statusKind != nil && !slices.Contains(summary.SuspendedKinds, *route.statusKind) {
					summary.SuspendedKinds = append(summary.SuspendedKinds, *route.statusKind)
				}
			}
		}
		slices.Sort(summary.SuspendedKinds)
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func (r *MemoryRepository) GetProvider(_ context.Context, id int) (ai.Provider, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.providers[id]
	if !ok {
		return ai.Provider{}, ai.ErrProviderNotFound
	}
	return stored.provider, nil
}

func (r *MemoryRepository) ProviderConnection(_ context.Context, id int) (ai.Connection, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.providers[id]
	if !ok {
		return ai.Connection{}, ai.ErrProviderNotFound
	}
	return connectionOf(stored), nil
}

func connectionOf(stored *storedProvider) ai.Connection {
	return ai.Connection{Kind: stored.provider.Kind, BaseURL: stored.provider.BaseURL, APIKey: stored.key}
}

func (r *MemoryRepository) ProviderNameTaken(_ context.Context, name string, exceptID int) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.nameTaken(name, exceptID), nil
}

func (r *MemoryRepository) nameTaken(name string, exceptID int) bool {
	for id, stored := range r.providers {
		if id != exceptID && stored.provider.Name == name {
			return true
		}
	}
	return false
}

func (r *MemoryRepository) CreateProvider(_ context.Context, in ai.NewProvider) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.nameTaken(in.Name, 0) {
		return 0, ai.ErrProviderNameTaken
	}
	r.nextProvider++
	now := r.clock()
	r.providers[r.nextProvider] = &storedProvider{
		provider: ai.Provider{
			ID:                r.nextProvider,
			Name:              in.Name,
			Kind:              in.Kind,
			BaseURL:           in.BaseURL,
			KeyHint:           keyHint(in.APIKey),
			PriceMultiplier:   in.PriceMultiplier,
			CatalogProviderID: in.CatalogProviderID,
			Enabled:           true,
			Created:           now,
			Updated:           now,
		},
		key: in.APIKey,
	}
	return r.nextProvider, nil
}

func (r *MemoryRepository) UpdateProvider(_ context.Context, id int, changes ai.ProviderChanges) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.providers[id]
	if !ok {
		return ai.ErrProviderNotFound
	}
	if changes.Name != nil && r.nameTaken(*changes.Name, id) {
		return ai.ErrProviderNameTaken
	}
	provider := &stored.provider
	if changes.Name != nil {
		provider.Name = *changes.Name
	}
	if changes.Kind != nil {
		provider.Kind = *changes.Kind
	}
	if changes.BaseURL != nil {
		provider.BaseURL = *changes.BaseURL
	}
	if changes.APIKey != nil {
		stored.key = *changes.APIKey
		provider.KeyHint = keyHint(*changes.APIKey)
	}
	if changes.PriceMultiplier != nil {
		provider.PriceMultiplier = *changes.PriceMultiplier
	}
	if changes.CatalogProviderID != nil {
		provider.CatalogProviderID = *changes.CatalogProviderID
	}
	if changes.Enabled != nil {
		provider.Enabled = *changes.Enabled
	}
	provider.Updated = r.clock()
	return nil
}

func (r *MemoryRepository) DeleteProvider(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.providers[id]; !ok {
		return ai.ErrProviderNotFound
	}
	delete(r.providers, id)
	delete(r.offers, id)
	for routeID, route := range r.routes {
		if route.providerID == id {
			r.deleteRoute(routeID)
		}
	}
	return nil
}

func (r *MemoryRepository) EnabledProviderIDs(context.Context) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []int{}
	for _, id := range sortedKeys(r.providers) {
		if r.providers[id].provider.Enabled {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (r *MemoryRepository) ReplaceOffers(_ context.Context, providerID int, offers []ai.Offer) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.providers[providerID]; !ok {
		return ai.ErrProviderNotFound
	}
	seen := map[string]bool{}
	stored := []ai.Offer{}
	for _, offer := range offers {
		if seen[offer.UpstreamID] {
			continue
		}
		seen[offer.UpstreamID] = true
		offer.ProviderID = providerID
		offer.Protocols = slices.Clone(offer.Protocols)
		if offer.SyncedAt.IsZero() {
			offer.SyncedAt = r.clock()
		}
		stored = append(stored, offer)
	}
	r.offers[providerID] = stored
	return nil
}

func (r *MemoryRepository) ListOffers(_ context.Context, filter ai.OfferFilter) ([]ai.Offer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	offers := []ai.Offer{}
	for _, providerID := range sortedKeys(r.offers) {
		if len(filter.ProviderIDs) > 0 && !slices.Contains(filter.ProviderIDs, providerID) {
			continue
		}
		if provider, ok := r.providers[providerID]; filter.EnabledOnly && (!ok || !provider.provider.Enabled) {
			continue
		}
		for _, offer := range r.offers[providerID] {
			if len(filter.UpstreamIDs) > 0 && !slices.Contains(filter.UpstreamIDs, offer.UpstreamID) {
				continue
			}
			if filter.WithCanonical && offer.CanonicalID == nil {
				continue
			}
			if len(filter.CanonicalIDs) > 0 && (offer.CanonicalID == nil || !slices.Contains(filter.CanonicalIDs, *offer.CanonicalID)) {
				continue
			}
			offers = append(offers, offer)
		}
	}
	slices.SortStableFunc(offers, func(a, b ai.Offer) int {
		return cmp.Or(cmp.Compare(a.ProviderID, b.ProviderID), cmp.Compare(a.UpstreamID, b.UpstreamID))
	})
	return offers, nil
}

func (r *MemoryRepository) ListModels(context.Context) ([]ai.Model, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	models := []ai.Model{}
	for _, model := range r.models {
		models = append(models, *model)
	}
	slices.SortFunc(models, func(a, b ai.Model) int {
		if a.IsDefault != b.IsDefault {
			if a.IsDefault {
				return -1
			}
			return 1
		}
		return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	return models, nil
}

func (r *MemoryRepository) GetModel(_ context.Context, id int) (ai.Model, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	model, ok := r.models[id]
	if !ok {
		return ai.Model{}, ai.ErrModelNotFound
	}
	return *model, nil
}

func (r *MemoryRepository) modelTaken(key string, canonical *string, exceptID int) bool {
	for id, model := range r.models {
		if id == exceptID {
			continue
		}
		if model.Key == key || (canonical != nil && model.CanonicalID != nil && *model.CanonicalID == *canonical) {
			return true
		}
	}
	return false
}

func (r *MemoryRepository) CreateModel(_ context.Context, in ai.NewModel) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.modelTaken(in.Key, in.CanonicalID, 0) {
		return 0, ai.ErrModelTaken
	}
	r.nextModel++
	now := r.clock()
	r.models[r.nextModel] = &ai.Model{
		ID:           r.nextModel,
		Key:          in.Key,
		Name:         in.Name,
		Description:  in.Description,
		CanonicalID:  in.CanonicalID,
		Capabilities: in.Capabilities,
		Enabled:      true,
		Created:      now,
		Updated:      now,
	}
	return r.nextModel, nil
}

func (r *MemoryRepository) UpdateModel(_ context.Context, id int, changes ai.ModelChanges) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	model, ok := r.models[id]
	if !ok {
		return ai.ErrModelNotFound
	}
	if changes.CanonicalID != nil && *changes.CanonicalID != nil && r.modelTaken("", *changes.CanonicalID, id) {
		return ai.ErrModelTaken
	}
	if changes.Name != nil {
		model.Name = *changes.Name
	}
	if changes.Description != nil {
		model.Description = *changes.Description
	}
	if changes.CanonicalID != nil {
		model.CanonicalID = *changes.CanonicalID
	}
	if changes.Capabilities != nil {
		model.Capabilities = *changes.Capabilities
	}
	if changes.Enabled != nil {
		model.Enabled = *changes.Enabled
	}
	if changes.IsDefault != nil {
		model.IsDefault = *changes.IsDefault
	}
	model.Updated = r.clock()
	return nil
}

func (r *MemoryRepository) ClearDefaultModel(_ context.Context, exceptID int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, model := range r.models {
		if id != exceptID {
			model.IsDefault = false
		}
	}
	return nil
}

func (r *MemoryRepository) DeleteModel(_ context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.models[id]; !ok {
		return ai.ErrModelNotFound
	}
	delete(r.models, id)
	for routeID, route := range r.routes {
		if route.modelID == id {
			r.deleteRoute(routeID)
		}
	}
	for key, scene := range r.scenes {
		if scene.ModelID != nil && *scene.ModelID == id {
			scene.ModelID = nil
			r.scenes[key] = scene
		}
	}
	return nil
}

func (r *MemoryRepository) deleteRoute(id int) {
	delete(r.routes, id)
	for adjustmentID, stored := range r.adjustments {
		if stored.routeID == id {
			delete(r.adjustments, adjustmentID)
		}
	}
}

func (r *MemoryRepository) route(stored *storedRoute) ai.Route {
	route := ai.Route{
		ID:            stored.id,
		Model:         ai.ModelRef{ID: stored.modelID},
		Provider:      ai.ProviderRef{ID: stored.providerID},
		UpstreamID:    stored.upstreamID,
		Protocol:      stored.protocol,
		PriceManual:   stored.priceManual,
		Price:         clonePrice(stored.price),
		DroppedParams: append([]string{}, stored.droppedParams...),
		JSONMode:      stored.jsonMode,
		Priority:      stored.priority,
		Status:        stored.status,
		StatusKind:    stored.statusKind,
		StatusMessage: stored.statusMessage,
		StatusAt:      stored.statusAt,
		Adjustments:   []ai.Adjustment{},
		Created:       stored.created,
		Updated:       stored.updated,
	}
	if model, ok := r.models[stored.modelID]; ok {
		route.Model = ai.ModelRef{ID: model.ID, Key: model.Key, Name: model.Name, Moderation: model.Moderation}
	}
	if provider, ok := r.providers[stored.providerID]; ok {
		route.Provider = ai.ProviderRef{ID: provider.provider.ID, Name: provider.provider.Name, Kind: provider.provider.Kind}
	}
	for _, adjustment := range r.adjustments {
		if adjustment.routeID == stored.id {
			route.Adjustments = append(route.Adjustments, adjustment.adjustment)
		}
	}
	slices.SortFunc(route.Adjustments, func(a, b ai.Adjustment) int {
		return cmp.Or(b.Created.Compare(a.Created), cmp.Compare(b.ID, a.ID))
	})
	return route
}

func clonePrice(price ai.Price) ai.Price {
	price.Tiers = slices.Clone(price.Tiers)
	return price
}

func (r *MemoryRepository) sortedRoutes(keep func(*storedRoute) bool) []*storedRoute {
	routes := []*storedRoute{}
	for _, route := range r.routes {
		if keep(route) {
			routes = append(routes, route)
		}
	}
	slices.SortFunc(routes, func(a, b *storedRoute) int {
		return cmp.Or(cmp.Compare(a.priority, b.priority), cmp.Compare(a.id, b.id))
	})
	return routes
}

func (r *MemoryRepository) ListRoutes(_ context.Context, filter ai.RouteFilter) ([]ai.Route, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	routes := []ai.Route{}
	for _, stored := range r.sortedRoutes(func(route *storedRoute) bool {
		return (filter.IDs == nil || slices.Contains(filter.IDs, route.id)) &&
			(filter.ModelID == nil || route.modelID == *filter.ModelID) &&
			(filter.ProviderID == nil || route.providerID == *filter.ProviderID) &&
			(filter.Status == nil || route.status == *filter.Status)
	}) {
		routes = append(routes, r.route(stored))
	}
	return routes, nil
}

func (r *MemoryRepository) GetRoute(_ context.Context, id int) (ai.Route, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.routes[id]
	if !ok {
		return ai.Route{}, ai.ErrRouteNotFound
	}
	return r.route(stored), nil
}

func (r *MemoryRepository) CreateRoute(_ context.Context, in ai.NewRoute) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.models[in.ModelID]; !ok {
		return 0, ai.ErrModelNotFound
	}
	if _, ok := r.providers[in.ProviderID]; !ok {
		return 0, ai.ErrProviderNotFound
	}
	for _, route := range r.routes {
		if route.modelID == in.ModelID && route.providerID == in.ProviderID {
			return 0, ai.ErrRouteTaken
		}
	}
	r.nextRoute++
	now := r.clock()
	r.routes[r.nextRoute] = &storedRoute{
		id:            r.nextRoute,
		modelID:       in.ModelID,
		providerID:    in.ProviderID,
		upstreamID:    in.UpstreamID,
		protocol:      in.Protocol,
		priceManual:   in.PriceManual,
		price:         clonePrice(in.Price),
		droppedParams: []string{},
		priority:      in.Priority,
		status:        ai.RouteActive,
		created:       now,
		updated:       now,
	}
	return r.nextRoute, nil
}

func (r *MemoryRepository) UpdateRoute(_ context.Context, id int, changes ai.RouteChanges) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	route, ok := r.routes[id]
	if !ok {
		return ai.ErrRouteNotFound
	}
	if changes.UpstreamID != nil {
		route.upstreamID = *changes.UpstreamID
	}
	if changes.Protocol != nil {
		route.protocol = *changes.Protocol
	}
	if changes.PriceManual != nil {
		route.priceManual = *changes.PriceManual
	}
	if changes.Price != nil {
		route.price = clonePrice(*changes.Price)
	}
	if changes.DroppedParams != nil {
		route.droppedParams = append([]string{}, *changes.DroppedParams...)
	}
	if changes.JSONMode != nil {
		route.jsonMode = *changes.JSONMode
	}
	route.updated = r.clock()
	return nil
}

func (r *MemoryRepository) DeleteRoutes(_ context.Context, ids []int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, id := range ids {
		if _, ok := r.routes[id]; ok {
			r.deleteRoute(id)
			count++
		}
	}
	return count, nil
}

func (r *MemoryRepository) SetRouteStatus(_ context.Context, ids []int, status ai.RouteStatus, at time.Time) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, id := range ids {
		route, ok := r.routes[id]
		if !ok {
			continue
		}
		stamp := at.UTC()
		route.status, route.statusKind, route.statusMessage, route.statusAt = status, nil, nil, &stamp
		count++
	}
	return count, nil
}

func (r *MemoryRepository) SetRoutePriorities(_ context.Context, ids []int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, id := range ids {
		if _, ok := r.routes[id]; !ok {
			return ai.ErrRouteNotFound
		}
	}
	for priority, id := range ids {
		r.routes[id].priority = priority
	}
	return nil
}

func (r *MemoryRepository) NextRoutePriority(_ context.Context, modelID int) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	next := 0
	for _, route := range r.routes {
		if route.modelID == modelID && route.priority+1 > next {
			next = route.priority + 1
		}
	}
	return next, nil
}

func (r *MemoryRepository) SuspendRoute(_ context.Context, id int, failure ai.Failure, at time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	route, ok := r.routes[id]
	if !ok || route.status != ai.RouteActive {
		return false, nil
	}
	kind, message, stamp := failure.Kind, clip(failure.Message, 500), at.UTC()
	route.status, route.statusKind, route.statusMessage, route.statusAt = ai.RouteSuspended, &kind, &message, &stamp
	return true, nil
}

func (r *MemoryRepository) RecoverRoute(_ context.Context, id int, at time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	route, ok := r.routes[id]
	if !ok || route.status != ai.RouteSuspended {
		return false, nil
	}
	stamp := at.UTC()
	route.status, route.statusKind, route.statusMessage, route.statusAt = ai.RouteActive, nil, nil, &stamp
	return true, nil
}

func (r *MemoryRepository) SuspendedRouteIDs(context.Context) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	routes := []*storedRoute{}
	for _, route := range r.routes {
		provider, ok := r.providers[route.providerID]
		if route.status == ai.RouteSuspended && ok && provider.provider.Enabled {
			routes = append(routes, route)
		}
	}
	slices.SortFunc(routes, func(a, b *storedRoute) int {
		var aAt, bAt time.Time
		if a.statusAt != nil {
			aAt = *a.statusAt
		}
		if b.statusAt != nil {
			bAt = *b.statusAt
		}
		return cmp.Or(aAt.Compare(bAt), cmp.Compare(a.id, b.id))
	})
	ids := make([]int, len(routes))
	for i, route := range routes {
		ids[i] = route.id
	}
	return ids, nil
}

func (r *MemoryRepository) SaveAdjustments(_ context.Context, routeID int, adjustments []ai.NewAdjustment) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.routes[routeID]; !ok {
		return ai.ErrRouteNotFound
	}
	for _, adjustment := range adjustments {
		now := r.clock()
		existing := r.findAdjustment(routeID, adjustment.Kind, adjustment.Value)
		if existing != nil {
			existing.adjustment.ErrorKind = adjustment.ErrorKind
			existing.adjustment.RequestID = adjustment.RequestID
			existing.adjustment.Created = now
			continue
		}
		r.nextAdjustment++
		r.adjustments[r.nextAdjustment] = &storedAdjustment{routeID: routeID, adjustment: ai.Adjustment{
			ID:        r.nextAdjustment,
			Kind:      adjustment.Kind,
			Value:     adjustment.Value,
			Previous:  adjustment.Previous,
			ErrorKind: adjustment.ErrorKind,
			RequestID: adjustment.RequestID,
			Created:   now,
		}}
	}
	return nil
}

func (r *MemoryRepository) findAdjustment(routeID int, kind ai.AdjustmentKind, value string) *storedAdjustment {
	for _, stored := range r.adjustments {
		if stored.routeID == routeID && stored.adjustment.Kind == kind && stored.adjustment.Value == value {
			return stored
		}
	}
	return nil
}

func (r *MemoryRepository) DeleteAdjustment(_ context.Context, routeID, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	stored, ok := r.adjustments[id]
	if !ok || stored.routeID != routeID {
		return ai.ErrAdjustmentNotFound
	}
	delete(r.adjustments, id)
	return nil
}

func (r *MemoryRepository) DeleteAdjustmentsOfKind(_ context.Context, routeID int, kind ai.AdjustmentKind) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, stored := range r.adjustments {
		if stored.routeID == routeID && stored.adjustment.Kind == kind {
			delete(r.adjustments, id)
		}
	}
	return nil
}

func (r *MemoryRepository) ListSceneConfigs(context.Context) ([]ai.SceneConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	configs := []ai.SceneConfig{}
	for _, key := range sortedKeys(r.scenes) {
		configs = append(configs, r.scenes[key])
	}
	return configs, nil
}

func (r *MemoryRepository) SceneConfig(_ context.Context, key string) (ai.SceneConfig, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	config, ok := r.scenes[key]
	if !ok {
		return ai.SceneConfig{Key: key}, false, nil
	}
	return config, true, nil
}

func (r *MemoryRepository) SaveSceneConfig(_ context.Context, config ai.SceneConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if config.ModelID != nil {
		if _, ok := r.models[*config.ModelID]; !ok {
			return ai.ErrModelNotFound
		}
	}
	r.scenes[config.Key] = config
	return nil
}

func (r *MemoryRepository) usableRoutes(modelID int) []*storedRoute {
	return r.sortedRoutes(func(route *storedRoute) bool {
		provider, ok := r.providers[route.providerID]
		return route.modelID == modelID && route.status == ai.RouteActive && ok && provider.provider.Enabled
	})
}

func (r *MemoryRepository) SceneModels(_ context.Context, ids []int) ([]ai.SceneModel, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	models := []ai.SceneModel{}
	for _, id := range sortedKeys(r.models) {
		if !slices.Contains(ids, id) {
			continue
		}
		model := r.models[id]
		models = append(models, ai.SceneModel{
			ModelRef:     ai.ModelRef{ID: model.ID, Key: model.Key, Name: model.Name, Moderation: model.Moderation},
			Enabled:      model.Enabled,
			ActiveRoutes: len(r.usableRoutes(id)),
		})
	}
	return models, nil
}

func (r *MemoryRepository) DefaultModelID(context.Context) (*int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, id := range sortedKeys(r.models) {
		if r.models[id].IsDefault {
			return &id, nil
		}
	}
	return nil, nil
}

func modelTarget(model *ai.Model) ai.ModelTarget {
	return ai.ModelTarget{
		ID:          model.ID,
		Key:         model.Key,
		Name:        model.Name,
		Temperature: model.Temperature,
		Moderation:  model.Moderation,
		OutputLimit: model.OutputLimit,
		Enabled:     model.Enabled,
	}
}

func (r *MemoryRepository) routeTarget(route *storedRoute) ai.RouteTarget {
	provider := r.providers[route.providerID]
	return ai.RouteTarget{
		ID:            route.id,
		ProviderID:    provider.provider.ID,
		ProviderName:  provider.provider.Name,
		Connection:    connectionOf(provider),
		UpstreamID:    route.upstreamID,
		Protocol:      route.protocol,
		Price:         clonePrice(route.price),
		DroppedParams: append([]string{}, route.droppedParams...),
		JSONMode:      route.jsonMode,
	}
}

func (r *MemoryRepository) ModelTarget(_ context.Context, id int) (ai.ModelTarget, []ai.RouteTarget, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	model, ok := r.models[id]
	if !ok {
		return ai.ModelTarget{}, nil, ai.ErrModelNotFound
	}
	targets := []ai.RouteTarget{}
	for _, route := range r.usableRoutes(id) {
		targets = append(targets, r.routeTarget(route))
	}
	return modelTarget(model), targets, nil
}

func (r *MemoryRepository) RouteTarget(_ context.Context, id int) (ai.ModelTarget, ai.RouteTarget, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	route, ok := r.routes[id]
	if !ok {
		return ai.ModelTarget{}, ai.RouteTarget{}, ai.ErrRouteNotFound
	}
	return modelTarget(r.models[route.modelID]), r.routeTarget(route), nil
}

func (r *MemoryRepository) SuperAdminIDs(context.Context) ([]int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]int{}, r.superAdmins...), nil
}

func (r *MemoryRepository) refs(modelID, providerID *int) (*ai.ModelRef, *ai.ProviderRef) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var model *ai.ModelRef
	var provider *ai.ProviderRef
	if modelID != nil {
		if stored, ok := r.models[*modelID]; ok {
			model = &ai.ModelRef{ID: stored.ID, Key: stored.Key, Name: stored.Name, Moderation: stored.Moderation}
		}
	}
	if providerID != nil {
		if stored, ok := r.providers[*providerID]; ok {
			provider = &ai.ProviderRef{ID: stored.provider.ID, Name: stored.provider.Name, Kind: stored.provider.Kind}
		}
	}
	return model, provider
}
