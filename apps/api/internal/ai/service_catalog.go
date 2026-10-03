package ai

import (
	"context"
	"slices"
	"time"
)

type CatalogOptions struct {
	StaleAfter  time.Duration
	SearchLimit int
}

type CatalogDeps struct {
	Source  CatalogSource
	Store   CatalogStore
	Repo    Repository
	Tx      Transactor
	Now     func() time.Time
	Options CatalogOptions
}

type CatalogService struct {
	source  CatalogSource
	store   CatalogStore
	repo    Repository
	tx      Transactor
	now     func() time.Time
	options CatalogOptions
}

func NewCatalogService(deps CatalogDeps) *CatalogService {
	return &CatalogService{source: deps.Source, store: deps.Store, repo: deps.Repo, tx: deps.Tx, now: deps.Now, options: deps.Options}
}

func (s *CatalogService) Status(ctx context.Context) (CatalogStatus, error) {
	return s.store.CatalogStatus(ctx)
}

func (s *CatalogService) Sync(ctx context.Context) (CatalogSyncResult, error) {
	catalog, err := s.source.Fetch(ctx)
	if err != nil {
		return CatalogSyncResult{}, err
	}
	var changes CatalogChanges
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		changes, err = s.store.ReplaceCatalog(ctx, catalog, s.now())
		return err
	})
	if err != nil {
		return CatalogSyncResult{}, err
	}
	repriced, err := s.Refresh(ctx)
	if err != nil {
		return CatalogSyncResult{}, err
	}
	return CatalogSyncResult{CatalogChanges: changes, Repriced: repriced}, nil
}

func (s *CatalogService) SyncIfStale(ctx context.Context) error {
	status, err := s.store.CatalogStatus(ctx)
	if err != nil {
		return err
	}
	if status.SyncedAt != nil && s.now().Sub(*status.SyncedAt) < s.options.StaleAfter {
		return nil
	}
	_, err = s.Sync(ctx)
	return err
}

func (s *CatalogService) Index(ctx context.Context) (CatalogIndex, error) {
	catalog, err := s.store.LoadCatalog(ctx)
	if err != nil {
		return CatalogIndex{}, err
	}
	return NewCatalogIndex(catalog), nil
}

func (s *CatalogService) Providers(ctx context.Context) ([]CatalogProviderEntry, error) {
	entries, err := s.store.CatalogProviders(ctx)
	if err != nil {
		return nil, err
	}
	out := entries[:0]
	for _, entry := range entries {
		kind, ok := entry.ProviderKind()
		if !ok {
			continue
		}
		entry.Kind = kind
		out = append(out, entry)
	}
	return out, nil
}

func (s *CatalogService) ProviderExists(ctx context.Context, id string) (bool, error) {
	index, err := s.Index(ctx)
	if err != nil {
		return false, err
	}
	_, ok := index.Provider(id)
	return ok, nil
}

func (s *CatalogService) Models(ctx context.Context, query string) ([]CatalogEntry, error) {
	canonicals, err := s.canonicals(ctx, query)
	if err != nil || len(canonicals) == 0 {
		return nil, err
	}
	index, err := s.Index(ctx)
	if err != nil {
		return nil, err
	}
	offers, err := s.repo.ListOffers(ctx, OfferFilter{CanonicalIDs: canonicals, EnabledOnly: true})
	if err != nil {
		return nil, err
	}
	providers, err := s.providerConnections(ctx)
	if err != nil {
		return nil, err
	}
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	var entries []CatalogEntry
	for _, canonical := range canonicals {
		official, ok := index.Official(canonical)
		if !ok {
			continue
		}
		entry := CatalogEntry{
			CanonicalID:  canonical,
			Name:         official.Name,
			Lab:          labOf(canonical),
			Capabilities: official.Capabilities(),
			InputPrice:   official.InputPrice,
			OutputPrice:  official.OutputPrice,
		}
		for _, model := range models {
			if model.CanonicalID != nil && *model.CanonicalID == canonical {
				id := model.ID
				entry.ModelID = &id
			}
		}
		for _, offer := range offers {
			provider, known := providers[offer.ProviderID]
			if offer.CanonicalID == nil || *offer.CanonicalID != canonical || !known {
				continue
			}
			described, ok := describe(index, provider.priced, UpstreamModel{ID: offer.UpstreamID, Name: offer.Name, Protocols: nilIfEmpty(offer.Protocols)})
			if !ok {
				continue
			}
			entry.Offers = append(entry.Offers, CatalogOffer{
				Provider:    provider.ref,
				UpstreamID:  offer.UpstreamID,
				Protocol:    described.Protocol,
				Protocols:   described.Protocols,
				InputPrice:  described.InputPrice,
				OutputPrice: described.OutputPrice,
			})
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func (s *CatalogService) canonicals(ctx context.Context, query string) ([]string, error) {
	limit := max(s.options.SearchLimit, 1)
	if query != "" {
		return s.store.SearchCanonicalIDs(ctx, query, limit)
	}
	offers, err := s.repo.ListOffers(ctx, OfferFilter{WithCanonical: true})
	if err != nil {
		return nil, err
	}
	var canonicals []string
	for _, offer := range offers {
		canonicals = append(canonicals, *offer.CanonicalID)
	}
	slices.Sort(canonicals)
	canonicals = slices.Compact(canonicals)
	return canonicals[:min(len(canonicals), limit)], nil
}

func (s *CatalogService) Refresh(ctx context.Context) (int, error) {
	index, err := s.Index(ctx)
	if err != nil || index.Empty() {
		return 0, err
	}
	models, err := s.linkModels(ctx, index)
	if err != nil {
		return 0, err
	}
	repriced, err := s.reprice(ctx, index, models)
	if err != nil {
		return 0, err
	}
	for _, model := range models {
		if model.CanonicalID == nil {
			continue
		}
		official, ok := index.Official(*model.CanonicalID)
		if !ok {
			continue
		}
		capabilities := official.Capabilities()
		capabilities.Moderation = capabilities.Moderation || model.Moderation
		if sameCapabilities(capabilities, model.Capabilities) {
			continue
		}
		if err := s.repo.UpdateModel(ctx, model.ID, ModelChanges{Capabilities: &capabilities}); err != nil {
			return 0, err
		}
	}
	return repriced, nil
}

func (s *CatalogService) linkModels(ctx context.Context, index CatalogIndex) (map[int]Model, error) {
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	taken := map[string]bool{}
	for _, model := range models {
		if model.CanonicalID != nil {
			taken[*model.CanonicalID] = true
		}
	}
	byID := make(map[int]Model, len(models))
	for _, model := range models {
		if model.CanonicalID == nil {
			if canonical, ok := index.CanonicalOf(model.Key); ok && !taken[canonical] {
				taken[canonical] = true
				linked := &canonical
				if err := s.repo.UpdateModel(ctx, model.ID, ModelChanges{CanonicalID: &linked}); err != nil {
					return nil, err
				}
				model.CanonicalID = linked
			}
		}
		byID[model.ID] = model
	}
	return byID, nil
}

func (s *CatalogService) reprice(ctx context.Context, index CatalogIndex, models map[int]Model) (int, error) {
	providers, err := s.providerConnections(ctx)
	if err != nil {
		return 0, err
	}
	routes, err := s.repo.ListRoutes(ctx, RouteFilter{})
	if err != nil {
		return 0, err
	}
	repriced := 0
	for _, route := range routes {
		provider, known := providers[route.Provider.ID]
		if route.PriceManual || !known {
			continue
		}
		entry, ok := index.Exact(provider.priced.CatalogProviderID, route.UpstreamID)
		if !ok {
			if canonical := models[route.Model.ID].CanonicalID; canonical != nil {
				entry, ok = index.Official(*canonical)
			}
		}
		if !ok || entry.InputPrice == nil {
			continue
		}
		price := scaledPrice(entry, provider.priced.PriceMultiplier)
		if samePrice(price, route.Price) {
			continue
		}
		if err := s.repo.UpdateRoute(ctx, route.ID, RouteChanges{Price: &price}); err != nil {
			return 0, err
		}
		repriced++
	}
	return repriced, nil
}

func (s *CatalogService) providerConnections(ctx context.Context) (map[int]providerConnection, error) {
	providers, err := s.repo.ListProviders(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[int]providerConnection, len(providers))
	for _, provider := range providers {
		out[provider.ID] = providerConnection{
			ref:    ProviderRef{ID: provider.ID, Name: provider.Name, Kind: provider.Kind},
			priced: pricedConnection{Kind: provider.Kind, CatalogProviderID: provider.CatalogProviderID, PriceMultiplier: provider.PriceMultiplier},
		}
	}
	return out, nil
}
