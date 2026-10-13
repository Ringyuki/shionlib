package aitest

import (
	"cmp"
	"context"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type MemoryCatalogStore struct {
	mu        sync.Mutex
	providers map[string]ai.CatalogProvider
	syncedAt  map[string]time.Time
	models    map[string]ai.CatalogModel
}

func NewMemoryCatalogStore() *MemoryCatalogStore {
	return &MemoryCatalogStore{
		providers: map[string]ai.CatalogProvider{},
		syncedAt:  map[string]time.Time{},
		models:    map[string]ai.CatalogModel{},
	}
}

func catalogKey(model ai.CatalogModel) string {
	return model.ProviderID + "|" + model.ModelKey
}

func normalizedCatalogModel(model ai.CatalogModel) ai.CatalogModel {
	if model.InputModalities == nil {
		model.InputModalities = []string{}
	}
	if model.OutputModalities == nil {
		model.OutputModalities = []string{}
	}
	if len(model.PriceTiers) == 0 {
		model.PriceTiers = nil
	}
	return model
}

func (s *MemoryCatalogStore) ReplaceCatalog(_ context.Context, catalog ai.Catalog, at time.Time) (ai.CatalogChanges, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	present := map[string]bool{}
	for _, provider := range catalog.Providers {
		if present[provider.ID] {
			continue
		}
		present[provider.ID] = true
		s.providers[provider.ID] = provider
		s.syncedAt[provider.ID] = at.UTC()
	}
	changes := ai.CatalogChanges{Providers: len(present)}
	seen := map[string]bool{}
	for _, model := range catalog.Models {
		key := catalogKey(model)
		if seen[key] || !present[model.ProviderID] {
			continue
		}
		seen[key] = true
		model = normalizedCatalogModel(model)
		old, ok := s.models[key]
		switch {
		case !ok:
			changes.Added++
		case !reflect.DeepEqual(old, model):
			changes.Updated++
		default:
			continue
		}
		s.models[key] = model
	}
	for key := range s.models {
		if !seen[key] {
			delete(s.models, key)
			changes.Removed++
		}
	}
	changes.Models = len(seen)
	return changes, nil
}

func (s *MemoryCatalogStore) LoadCatalog(context.Context) (ai.Catalog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	catalog := ai.Catalog{Providers: []ai.CatalogProvider{}, Models: []ai.CatalogModel{}}
	for _, id := range sortedKeys(s.providers) {
		catalog.Providers = append(catalog.Providers, s.providers[id])
	}
	for _, key := range sortedKeys(s.models) {
		catalog.Models = append(catalog.Models, s.models[key])
	}
	slices.SortStableFunc(catalog.Models, func(a, b ai.CatalogModel) int {
		return cmp.Or(cmp.Compare(a.ProviderID, b.ProviderID), cmp.Compare(a.ModelKey, b.ModelKey))
	})
	return catalog, nil
}

func (s *MemoryCatalogStore) CatalogStatus(context.Context) (ai.CatalogStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	status := ai.CatalogStatus{Providers: len(s.providers), Models: len(s.models)}
	for _, at := range s.syncedAt {
		if status.SyncedAt == nil || at.After(*status.SyncedAt) {
			latest := at
			status.SyncedAt = &latest
		}
	}
	return status, nil
}

func (s *MemoryCatalogStore) CatalogProviders(context.Context) ([]ai.CatalogProviderEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries := []ai.CatalogProviderEntry{}
	for _, provider := range s.providers {
		entry := ai.CatalogProviderEntry{CatalogProvider: provider}
		for _, model := range s.models {
			if model.ProviderID == provider.ID {
				entry.Models++
			}
		}
		entries = append(entries, entry)
	}
	slices.SortFunc(entries, func(a, b ai.CatalogProviderEntry) int {
		return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	return entries, nil
}

func (s *MemoryCatalogStore) SearchCanonicalIDs(_ context.Context, query string, limit int) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	needle := strings.ToLower(strings.TrimSpace(query))
	found := map[string]bool{}
	for _, model := range s.models {
		if model.CanonicalID == nil {
			continue
		}
		if strings.Contains(strings.ToLower(model.Name), needle) || strings.Contains(strings.ToLower(*model.CanonicalID), needle) {
			found[*model.CanonicalID] = true
		}
	}
	ids := sortedKeys(found)
	if len(ids) > limit {
		ids = ids[:limit]
	}
	return ids, nil
}
