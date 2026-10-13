package aipg

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aiprovider"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aiprovideroffer"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airoute"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const (
	uniqueProviderName   = "ai_providers_name_key"
	providerCatalogFK    = "ai_providers_catalog_provider_id_fkey"
	offerProviderFK      = "ai_provider_offers_provider_id_fkey"
	uniqueModelKey       = "ai_models_key_key"
	uniqueModelCanonical = "ai_models_canonical_id_key"
	uniqueRoute          = "ai_routes_model_id_provider_id_key"
	routeModelFK         = "ai_routes_model_id_fkey"
	routeProviderFK      = "ai_routes_provider_id_fkey"
	sceneModelFK         = "ai_scenes_model_id_fkey"
	adjustmentRouteFK    = "ai_route_adjustments_route_id_fkey"
	adjustmentRequestFK  = "ai_route_adjustments_request_id_fkey"
	superAdminRole       = 3
	activeUserStatus     = 1
	batchSize            = 500
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) ListProviders(ctx context.Context) ([]ai.ProviderSummary, error) {
	rows, err := r.db(ctx).AIProvider.Query().
		WithRoutes(func(q *ent.AIRouteQuery) { q.Order(ent.Asc(airoute.FieldID)) }).
		Order(ent.Asc(aiprovider.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai providers: %w", err)
	}
	summaries := make([]ai.ProviderSummary, len(rows))
	for i, row := range rows {
		summary := ai.ProviderSummary{Provider: toProvider(row), SuspendedKinds: []ai.ErrorKind{}, UpstreamIDs: []string{}}
		for _, route := range row.Edges.Routes {
			summary.Routes.Total++
			summary.UpstreamIDs = append(summary.UpstreamIDs, route.UpstreamID)
			switch ai.RouteStatus(route.Status) {
			case ai.RouteActive:
				summary.Routes.Active++
			case ai.RouteDisabled:
				summary.Routes.Disabled++
			case ai.RouteSuspended:
				summary.Routes.Suspended++
				if route.StatusKind != nil && !slices.Contains(summary.SuspendedKinds, ai.ErrorKind(*route.StatusKind)) {
					summary.SuspendedKinds = append(summary.SuspendedKinds, ai.ErrorKind(*route.StatusKind))
				}
			}
		}
		slices.Sort(summary.SuspendedKinds)
		summaries[i] = summary
	}
	return summaries, nil
}

func (r *Repository) GetProvider(ctx context.Context, id int) (ai.Provider, error) {
	row, err := r.db(ctx).AIProvider.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return ai.Provider{}, ai.ErrProviderNotFound
	}
	if err != nil {
		return ai.Provider{}, fmt.Errorf("get ai provider %d: %w", id, err)
	}
	return toProvider(row), nil
}

func (r *Repository) ProviderConnection(ctx context.Context, id int) (ai.Connection, error) {
	row, err := r.db(ctx).AIProvider.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return ai.Connection{}, ai.ErrProviderNotFound
	}
	if err != nil {
		return ai.Connection{}, fmt.Errorf("get ai provider %d: %w", id, err)
	}
	return toConnection(row), nil
}

func (r *Repository) ProviderNameTaken(ctx context.Context, name string, exceptID int) (bool, error) {
	taken, err := r.db(ctx).AIProvider.Query().Where(aiprovider.Name(name), aiprovider.IDNEQ(exceptID)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check ai provider name: %w", err)
	}
	return taken, nil
}

func (r *Repository) CreateProvider(ctx context.Context, in ai.NewProvider) (int, error) {
	row, err := r.db(ctx).AIProvider.Create().
		SetName(in.Name).
		SetKind(string(in.Kind)).
		SetNillableBaseURL(in.BaseURL).
		SetAPIKey(in.APIKey).
		SetKeyHint(keyHint(in.APIKey)).
		SetPriceMultiplier(in.PriceMultiplier).
		SetNillableCatalogProviderID(in.CatalogProviderID).
		Save(ctx)
	if err != nil {
		return 0, translateProvider(err, "create ai provider")
	}
	return row.ID, nil
}

func (r *Repository) UpdateProvider(ctx context.Context, id int, changes ai.ProviderChanges) error {
	update := r.db(ctx).AIProvider.UpdateOneID(id)
	if changes.Name != nil {
		update.SetName(*changes.Name)
	}
	if changes.Kind != nil {
		update.SetKind(string(*changes.Kind))
	}
	if changes.BaseURL != nil {
		if *changes.BaseURL == nil {
			update.ClearBaseURL()
		} else {
			update.SetBaseURL(**changes.BaseURL)
		}
	}
	if changes.APIKey != nil {
		update.SetAPIKey(*changes.APIKey).SetKeyHint(keyHint(*changes.APIKey))
	}
	if changes.PriceMultiplier != nil {
		update.SetPriceMultiplier(*changes.PriceMultiplier)
	}
	if changes.CatalogProviderID != nil {
		if *changes.CatalogProviderID == nil {
			update.ClearCatalogProviderID()
		} else {
			update.SetCatalogProviderID(**changes.CatalogProviderID)
		}
	}
	if changes.Enabled != nil {
		update.SetEnabled(*changes.Enabled)
	}
	if _, err := update.Save(ctx); err != nil {
		return translateProvider(err, fmt.Sprintf("update ai provider %d", id))
	}
	return nil
}

func translateProvider(err error, action string) error {
	switch {
	case postgres.IsNotFound(err):
		return ai.ErrProviderNotFound
	case postgres.IsUniqueViolation(err, uniqueProviderName):
		return ai.ErrProviderNameTaken
	case postgres.IsForeignKeyViolation(err, providerCatalogFK):
		return ai.ErrCatalogModelNotFound.Wrap(err)
	}
	return fmt.Errorf("%s: %w", action, err)
}

func (r *Repository) DeleteProvider(ctx context.Context, id int) error {
	err := r.db(ctx).AIProvider.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return ai.ErrProviderNotFound
	}
	if err != nil {
		return fmt.Errorf("delete ai provider %d: %w", id, err)
	}
	return nil
}

func (r *Repository) EnabledProviderIDs(ctx context.Context) ([]int, error) {
	ids, err := r.db(ctx).AIProvider.Query().Where(aiprovider.Enabled(true)).Order(ent.Asc(aiprovider.FieldID)).IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list enabled ai providers: %w", err)
	}
	return ids, nil
}

func (r *Repository) ReplaceOffers(ctx context.Context, providerID int, offers []ai.Offer) error {
	exists, err := r.db(ctx).AIProvider.Query().Where(aiprovider.ID(providerID)).Exist(ctx)
	if err != nil {
		return fmt.Errorf("check ai provider %d: %w", providerID, err)
	}
	if !exists {
		return ai.ErrProviderNotFound
	}
	if _, err := r.db(ctx).AIProviderOffer.Delete().Where(aiprovideroffer.ProviderID(providerID)).Exec(ctx); err != nil {
		return fmt.Errorf("clear ai provider %d offers: %w", providerID, err)
	}
	seen := map[string]bool{}
	var builders []*ent.AIProviderOfferCreate
	for _, offer := range offers {
		if seen[offer.UpstreamID] {
			continue
		}
		seen[offer.UpstreamID] = true
		protocols := make(pgvalue.Strings, len(offer.Protocols))
		for i, protocol := range offer.Protocols {
			protocols[i] = string(protocol)
		}
		syncedAt := offer.SyncedAt
		if syncedAt.IsZero() {
			syncedAt = time.Now().UTC()
		}
		builders = append(builders, r.db(ctx).AIProviderOffer.Create().
			SetProviderID(providerID).
			SetUpstreamID(offer.UpstreamID).
			SetNillableName(offer.Name).
			SetProtocols(protocols).
			SetNillableCanonicalID(offer.CanonicalID).
			SetSyncedAt(syncedAt))
	}
	for start := 0; start < len(builders); start += batchSize {
		end := min(start+batchSize, len(builders))
		if err := r.db(ctx).AIProviderOffer.CreateBulk(builders[start:end]...).Exec(ctx); err != nil {
			if postgres.IsForeignKeyViolation(err, offerProviderFK) {
				return ai.ErrProviderNotFound
			}
			return fmt.Errorf("store ai provider %d offers: %w", providerID, err)
		}
	}
	return nil
}

func (r *Repository) ListOffers(ctx context.Context, filter ai.OfferFilter) ([]ai.Offer, error) {
	query := r.db(ctx).AIProviderOffer.Query()
	if len(filter.ProviderIDs) > 0 {
		query.Where(aiprovideroffer.ProviderIDIn(filter.ProviderIDs...))
	}
	if len(filter.UpstreamIDs) > 0 {
		query.Where(aiprovideroffer.UpstreamIDIn(filter.UpstreamIDs...))
	}
	if len(filter.CanonicalIDs) > 0 {
		query.Where(aiprovideroffer.CanonicalIDIn(filter.CanonicalIDs...))
	}
	if filter.WithCanonical {
		query.Where(aiprovideroffer.CanonicalIDNotNil())
	}
	if filter.EnabledOnly {
		query.Where(aiprovideroffer.HasProviderWith(aiprovider.Enabled(true)))
	}
	rows, err := query.Order(ent.Asc(aiprovideroffer.FieldProviderID), ent.Asc(aiprovideroffer.FieldUpstreamID)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai provider offers: %w", err)
	}
	offers := make([]ai.Offer, len(rows))
	for i, row := range rows {
		offers[i] = toOffer(row)
	}
	return offers, nil
}
