package ai

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Upstream interface {
	Generate(ctx context.Context, request Generation) (Completion, error)
	Classify(ctx context.Context, request Classification) (Classified, error)
	ListModels(ctx context.Context, connection Connection) ([]UpstreamModel, error)
	Endpoint(route RouteTarget) string
}

type CatalogSource interface {
	Fetch(ctx context.Context) (Catalog, error)
}

type Repository interface {
	ListProviders(ctx context.Context) ([]ProviderSummary, error)
	GetProvider(ctx context.Context, id int) (Provider, error)
	ProviderConnection(ctx context.Context, id int) (Connection, error)
	ProviderNameTaken(ctx context.Context, name string, exceptID int) (bool, error)
	CreateProvider(ctx context.Context, in NewProvider) (int, error)
	UpdateProvider(ctx context.Context, id int, changes ProviderChanges) error
	DeleteProvider(ctx context.Context, id int) error
	EnabledProviderIDs(ctx context.Context) ([]int, error)
	ReplaceOffers(ctx context.Context, providerID int, offers []Offer) error
	ListOffers(ctx context.Context, filter OfferFilter) ([]Offer, error)

	ListModels(ctx context.Context) ([]Model, error)
	GetModel(ctx context.Context, id int) (Model, error)
	CreateModel(ctx context.Context, in NewModel) (int, error)
	UpdateModel(ctx context.Context, id int, changes ModelChanges) error
	ClearDefaultModel(ctx context.Context, exceptID int) error
	DeleteModel(ctx context.Context, id int) error

	ListRoutes(ctx context.Context, filter RouteFilter) ([]Route, error)
	GetRoute(ctx context.Context, id int) (Route, error)
	CreateRoute(ctx context.Context, in NewRoute) (int, error)
	UpdateRoute(ctx context.Context, id int, changes RouteChanges) error
	DeleteRoutes(ctx context.Context, ids []int) (int, error)
	SetRouteStatus(ctx context.Context, ids []int, status RouteStatus, at time.Time) (int, error)
	SetRoutePriorities(ctx context.Context, ids []int) error
	NextRoutePriority(ctx context.Context, modelID int) (int, error)
	SuspendRoute(ctx context.Context, id int, failure Failure, at time.Time) (bool, error)
	RecoverRoute(ctx context.Context, id int, at time.Time) (bool, error)
	SuspendedRouteIDs(ctx context.Context) ([]int, error)
	SaveAdjustments(ctx context.Context, routeID int, adjustments []NewAdjustment) error
	DeleteAdjustment(ctx context.Context, routeID, id int) error
	DeleteAdjustmentsOfKind(ctx context.Context, routeID int, kind AdjustmentKind) error

	ListSceneConfigs(ctx context.Context) ([]SceneConfig, error)
	SceneConfig(ctx context.Context, key string) (SceneConfig, bool, error)
	SaveSceneConfig(ctx context.Context, config SceneConfig) error
	SceneModels(ctx context.Context, ids []int) ([]SceneModel, error)
	DefaultModelID(ctx context.Context) (*int, error)

	ModelTarget(ctx context.Context, id int) (ModelTarget, []RouteTarget, error)
	RouteTarget(ctx context.Context, id int) (ModelTarget, RouteTarget, error)

	SuperAdminIDs(ctx context.Context) ([]int, error)
}

type CatalogStore interface {
	ReplaceCatalog(ctx context.Context, catalog Catalog, at time.Time) (CatalogChanges, error)
	LoadCatalog(ctx context.Context) (Catalog, error)
	CatalogStatus(ctx context.Context) (CatalogStatus, error)
	CatalogProviders(ctx context.Context) ([]CatalogProviderEntry, error)
	SearchCanonicalIDs(ctx context.Context, query string, limit int) ([]string, error)
}

type RequestLog interface {
	Record(ctx context.Context, record RequestRecord) (int64, error)
	ListRequests(ctx context.Context, filter RequestFilter, page Page) ([]Request, int, error)
	GetRequest(ctx context.Context, id int64) (RequestDetail, error)
	Attempts(ctx context.Context, callID string) ([]Request, error)
	PurgeRequests(ctx context.Context, before time.Time) (int, error)
	PurgePayloads(ctx context.Context, before time.Time) (int, error)
}

type StatsStore interface {
	Grouped(ctx context.Context, dimension Dimension, since time.Time) (map[string]Stats, error)
	LatestAttempts(ctx context.Context, routeIDs []int) (map[int]LastAttempt, error)
	LastUsed(ctx context.Context) (map[int]time.Time, error)
	Metrics(ctx context.Context, filter RequestFilter, until time.Time) (Stats, error)
	Buckets(ctx context.Context, filter RequestFilter, bucket time.Duration) ([]SeriesBucket, error)
	CostBuckets(ctx context.Context, filter RequestFilter, bucket time.Duration) ([]CostBucket, error)
	Breakdown(ctx context.Context, dimension Dimension, since time.Time, limit int) ([]BreakdownRow, error)
}

type Job = interface{ Kind() string }

type Queue interface {
	Enqueue(ctx context.Context, job Job) error
}

type Messenger interface {
	Send(ctx context.Context, in message.NewMessage) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
