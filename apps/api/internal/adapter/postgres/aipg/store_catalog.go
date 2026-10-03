package aipg

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aicatalogmodel"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aicatalogprovider"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

type CatalogStore struct {
	client *ent.Client
}

func NewCatalogStore(client *ent.Client) *CatalogStore {
	return &CatalogStore{client: client}
}

func (s *CatalogStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *CatalogStore) ReplaceCatalog(ctx context.Context, catalog ai.Catalog, at time.Time) (ai.CatalogChanges, error) {
	at = at.UTC()
	providers := map[string]bool{}
	var providerBuilders []*ent.AICatalogProviderCreate
	for _, provider := range catalog.Providers {
		if providers[provider.ID] {
			continue
		}
		providers[provider.ID] = true
		providerBuilders = append(providerBuilders, s.db(ctx).AICatalogProvider.Create().
			SetID(provider.ID).
			SetName(provider.Name).
			SetNillableNpm(provider.NPM).
			SetNillableAPIURL(provider.APIURL).
			SetNillableDocURL(provider.DocURL).
			SetSyncedAt(at))
	}
	for start := 0; start < len(providerBuilders); start += batchSize {
		end := min(start+batchSize, len(providerBuilders))
		err := s.db(ctx).AICatalogProvider.CreateBulk(providerBuilders[start:end]...).
			OnConflict(
				entsql.ConflictColumns(aicatalogprovider.FieldID),
				entsql.ResolveWith(func(set *entsql.UpdateSet) {
					set.SetExcluded(aicatalogprovider.FieldName)
					set.SetExcluded(aicatalogprovider.FieldNpm)
					set.SetExcluded(aicatalogprovider.FieldAPIURL)
					set.SetExcluded(aicatalogprovider.FieldDocURL)
					set.SetExcluded(aicatalogprovider.FieldSyncedAt)
				}),
			).
			Exec(ctx)
		if err != nil {
			return ai.CatalogChanges{}, fmt.Errorf("upsert ai catalog providers: %w", err)
		}
	}
	existing, err := s.db(ctx).AICatalogModel.Query().All(ctx)
	if err != nil {
		return ai.CatalogChanges{}, fmt.Errorf("load ai catalog models: %w", err)
	}
	known := make(map[string]*ent.AICatalogModel, len(existing))
	for _, row := range existing {
		known[row.ProviderID+"|"+row.ModelKey] = row
	}
	changes := ai.CatalogChanges{Providers: len(providers)}
	seen := map[string]bool{}
	var inserts []*ent.AICatalogModelCreate
	for _, model := range catalog.Models {
		key := model.ProviderID + "|" + model.ModelKey
		if seen[key] || !providers[model.ProviderID] {
			continue
		}
		seen[key] = true
		old, ok := known[key]
		if !ok {
			create, err := s.catalogModelCreate(ctx, model, at)
			if err != nil {
				return ai.CatalogChanges{}, err
			}
			inserts = append(inserts, create)
			continue
		}
		if sameCatalogModel(toCatalogModel(old), model) {
			continue
		}
		if err := s.updateCatalogModel(ctx, old.ID, model, at); err != nil {
			return ai.CatalogChanges{}, err
		}
		changes.Updated++
	}
	for start := 0; start < len(inserts); start += batchSize {
		end := min(start+batchSize, len(inserts))
		if err := s.db(ctx).AICatalogModel.CreateBulk(inserts[start:end]...).Exec(ctx); err != nil {
			return ai.CatalogChanges{}, fmt.Errorf("insert ai catalog models: %w", err)
		}
	}
	changes.Added = len(inserts)
	var removed []int
	for key, row := range known {
		if !seen[key] {
			removed = append(removed, row.ID)
		}
	}
	for start := 0; start < len(removed); start += batchSize {
		end := min(start+batchSize, len(removed))
		if _, err := s.db(ctx).AICatalogModel.Delete().Where(aicatalogmodel.IDIn(removed[start:end]...)).Exec(ctx); err != nil {
			return ai.CatalogChanges{}, fmt.Errorf("remove ai catalog models: %w", err)
		}
	}
	changes.Removed = len(removed)
	changes.Models = len(seen)
	return changes, nil
}

func sameCatalogModel(a, b ai.CatalogModel) bool {
	a.InputModalities, b.InputModalities = nonNil(a.InputModalities), nonNil(b.InputModalities)
	a.OutputModalities, b.OutputModalities = nonNil(a.OutputModalities), nonNil(b.OutputModalities)
	if len(a.PriceTiers) == 0 {
		a.PriceTiers = nil
	}
	if len(b.PriceTiers) == 0 {
		b.PriceTiers = nil
	}
	return reflect.DeepEqual(a, b)
}

func (s *CatalogStore) catalogModelCreate(ctx context.Context, model ai.CatalogModel, at time.Time) (*ent.AICatalogModelCreate, error) {
	tiers, err := encodeTiers(model.PriceTiers)
	if err != nil {
		return nil, err
	}
	create := s.db(ctx).AICatalogModel.Create().
		SetProviderID(model.ProviderID).
		SetModelKey(model.ModelKey).
		SetNillableCanonicalID(model.CanonicalID).
		SetName(model.Name).
		SetNillableType(model.Type).
		SetNillableFamily(model.Family).
		SetNillableNpm(model.NPM).
		SetInputModalities(pgvalue.Strings(nonNil(model.InputModalities))).
		SetOutputModalities(pgvalue.Strings(nonNil(model.OutputModalities))).
		SetNillableContextLimit(model.ContextLimit).
		SetNillableOutputLimit(model.OutputLimit).
		SetTemperature(model.Temperature).
		SetToolCall(model.ToolCall).
		SetReasoning(model.Reasoning).
		SetNillableStructuredOutput(model.StructuredOutput).
		SetNillableInputPrice(model.InputPrice).
		SetNillableOutputPrice(model.OutputPrice).
		SetNillableCacheReadPrice(model.CacheReadPrice).
		SetNillableCacheWritePrice(model.CacheWritePrice).
		SetNillableReleaseDate(model.ReleaseDate).
		SetSyncedAt(at)
	if tiers != nil {
		create.SetPriceTiers(tiers)
	}
	return create, nil
}

func (s *CatalogStore) updateCatalogModel(ctx context.Context, id int, model ai.CatalogModel, at time.Time) error {
	tiers, err := encodeTiers(model.PriceTiers)
	if err != nil {
		return err
	}
	update := s.db(ctx).AICatalogModel.UpdateOneID(id).
		SetName(model.Name).
		SetInputModalities(pgvalue.Strings(nonNil(model.InputModalities))).
		SetOutputModalities(pgvalue.Strings(nonNil(model.OutputModalities))).
		SetTemperature(model.Temperature).
		SetToolCall(model.ToolCall).
		SetReasoning(model.Reasoning).
		SetSyncedAt(at)
	setOrClear(model.CanonicalID, update.SetCanonicalID, update.ClearCanonicalID)
	setOrClear(model.Type, update.SetType, update.ClearType)
	setOrClear(model.Family, update.SetFamily, update.ClearFamily)
	setOrClear(model.NPM, update.SetNpm, update.ClearNpm)
	setOrClear(model.ContextLimit, update.SetContextLimit, update.ClearContextLimit)
	setOrClear(model.OutputLimit, update.SetOutputLimit, update.ClearOutputLimit)
	setOrClear(model.StructuredOutput, update.SetStructuredOutput, update.ClearStructuredOutput)
	setOrClear(model.InputPrice, update.SetInputPrice, update.ClearInputPrice)
	setOrClear(model.OutputPrice, update.SetOutputPrice, update.ClearOutputPrice)
	setOrClear(model.CacheReadPrice, update.SetCacheReadPrice, update.ClearCacheReadPrice)
	setOrClear(model.CacheWritePrice, update.SetCacheWritePrice, update.ClearCacheWritePrice)
	setOrClear(model.ReleaseDate, update.SetReleaseDate, update.ClearReleaseDate)
	if tiers == nil {
		update.ClearPriceTiers()
	} else {
		update.SetPriceTiers(tiers)
	}
	if _, err := update.Save(ctx); err != nil {
		return fmt.Errorf("update ai catalog model %d: %w", id, err)
	}
	return nil
}

func setOrClear[T any, B any](value *T, set func(T) B, clear func() B) {
	if value == nil {
		clear()
		return
	}
	set(*value)
}

func (s *CatalogStore) LoadCatalog(ctx context.Context) (ai.Catalog, error) {
	providers, err := s.db(ctx).AICatalogProvider.Query().Order(ent.Asc(aicatalogprovider.FieldID)).All(ctx)
	if err != nil {
		return ai.Catalog{}, fmt.Errorf("load ai catalog providers: %w", err)
	}
	models, err := s.db(ctx).AICatalogModel.Query().
		Order(ent.Asc(aicatalogmodel.FieldProviderID), ent.Asc(aicatalogmodel.FieldModelKey)).
		All(ctx)
	if err != nil {
		return ai.Catalog{}, fmt.Errorf("load ai catalog models: %w", err)
	}
	catalog := ai.Catalog{Providers: make([]ai.CatalogProvider, len(providers)), Models: make([]ai.CatalogModel, len(models))}
	for i, row := range providers {
		catalog.Providers[i] = toCatalogProvider(row)
	}
	for i, row := range models {
		catalog.Models[i] = toCatalogModel(row)
	}
	return catalog, nil
}

func (s *CatalogStore) CatalogStatus(ctx context.Context) (ai.CatalogStatus, error) {
	rows, err := s.db(ctx).QueryContext(ctx, `
SELECT
  (SELECT count(*) FROM ai_catalog_providers)::int,
  (SELECT count(*) FROM ai_catalog_models)::int,
  (SELECT max(synced_at) FROM ai_catalog_providers)`)
	if err != nil {
		return ai.CatalogStatus{}, fmt.Errorf("read ai catalog status: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var status ai.CatalogStatus
	if rows.Next() {
		var syncedAt *time.Time
		if err := rows.Scan(&status.Providers, &status.Models, &syncedAt); err != nil {
			return ai.CatalogStatus{}, fmt.Errorf("scan ai catalog status: %w", err)
		}
		if syncedAt != nil {
			utc := syncedAt.UTC()
			status.SyncedAt = &utc
		}
	}
	if err := rows.Err(); err != nil {
		return ai.CatalogStatus{}, fmt.Errorf("read ai catalog status: %w", err)
	}
	return status, nil
}

func (s *CatalogStore) CatalogProviders(ctx context.Context) ([]ai.CatalogProviderEntry, error) {
	rows, err := s.db(ctx).QueryContext(ctx, `
SELECT p.id, p.name, p.npm, p.api_url, p.doc_url, count(m.id)::int
FROM ai_catalog_providers p
LEFT JOIN ai_catalog_models m ON m.provider_id = p.id
GROUP BY p.id
ORDER BY p.name, p.id`)
	if err != nil {
		return nil, fmt.Errorf("list ai catalog providers: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	entries := []ai.CatalogProviderEntry{}
	for rows.Next() {
		var entry ai.CatalogProviderEntry
		if err := rows.Scan(&entry.ID, &entry.Name, &entry.NPM, &entry.APIURL, &entry.DocURL, &entry.Models); err != nil {
			return nil, fmt.Errorf("scan ai catalog provider: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai catalog providers: %w", err)
	}
	return entries, nil
}

func (s *CatalogStore) SearchCanonicalIDs(ctx context.Context, query string, limit int) ([]string, error) {
	pattern := "%" + likeEscaper.Replace(strings.TrimSpace(query)) + "%"
	rows, err := s.db(ctx).QueryContext(ctx, `
SELECT DISTINCT canonical_id
FROM ai_catalog_models
WHERE canonical_id IS NOT NULL AND (name ILIKE $1 ESCAPE '\' OR canonical_id ILIKE $1 ESCAPE '\')
ORDER BY canonical_id
LIMIT $2`, pattern, limit)
	if err != nil {
		return nil, fmt.Errorf("search ai catalog: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan ai catalog canonical id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai catalog search: %w", err)
	}
	return ids, nil
}
