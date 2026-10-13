package aipg

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aimodel"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aiprovider"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airoute"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aiscene"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func (r *Repository) ListSceneConfigs(ctx context.Context) ([]ai.SceneConfig, error) {
	rows, err := r.db(ctx).AIScene.Query().Order(ent.Asc(aiscene.FieldKey)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai scenes: %w", err)
	}
	configs := make([]ai.SceneConfig, len(rows))
	for i, row := range rows {
		configs[i] = toSceneConfig(row)
	}
	return configs, nil
}

func (r *Repository) SceneConfig(ctx context.Context, key string) (ai.SceneConfig, bool, error) {
	row, err := r.db(ctx).AIScene.Query().Where(aiscene.Key(key)).Only(ctx)
	if postgres.IsNotFound(err) {
		return ai.SceneConfig{Key: key}, false, nil
	}
	if err != nil {
		return ai.SceneConfig{}, false, fmt.Errorf("get ai scene %s: %w", key, err)
	}
	return toSceneConfig(row), true, nil
}

func (r *Repository) SaveSceneConfig(ctx context.Context, config ai.SceneConfig) error {
	create := r.db(ctx).AIScene.Create().
		SetKey(config.Key).
		SetNillableModelID(config.ModelID).
		SetNillableTemperature(config.Temperature).
		SetNillableMaxOutputTokens(config.MaxOutputTokens).
		SetUpdated(time.Now().UTC())
	if config.Timeout != nil {
		create.SetTimeoutMs(int(config.Timeout.Milliseconds()))
	}
	err := create.OnConflict(
		entsql.ConflictColumns(aiscene.FieldKey),
		entsql.ResolveWith(func(set *entsql.UpdateSet) {
			set.SetExcluded(aiscene.FieldModelID)
			set.SetExcluded(aiscene.FieldTemperature)
			set.SetExcluded(aiscene.FieldMaxOutputTokens)
			set.SetExcluded(aiscene.FieldTimeoutMs)
			set.SetExcluded(aiscene.FieldUpdated)
		}),
	).Exec(ctx)
	if postgres.IsForeignKeyViolation(err, sceneModelFK) {
		return ai.ErrModelNotFound
	}
	if err != nil {
		return fmt.Errorf("save ai scene %s: %w", config.Key, err)
	}
	return nil
}

func usableRoutes(q *ent.AIRouteQuery) {
	q.Where(airoute.Status(string(ai.RouteActive)), airoute.HasProviderWith(aiprovider.Enabled(true)))
}

func (r *Repository) SceneModels(ctx context.Context, ids []int) ([]ai.SceneModel, error) {
	if len(ids) == 0 {
		return []ai.SceneModel{}, nil
	}
	rows, err := r.db(ctx).AIModel.Query().
		Where(aimodel.IDIn(ids...)).
		WithRoutes(usableRoutes).
		Order(ent.Asc(aimodel.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load ai scene models: %w", err)
	}
	models := make([]ai.SceneModel, len(rows))
	for i, row := range rows {
		models[i] = ai.SceneModel{ModelRef: toModelRef(row), Enabled: row.Enabled, ActiveRoutes: len(row.Edges.Routes)}
	}
	return models, nil
}

func (r *Repository) DefaultModelID(ctx context.Context) (*int, error) {
	id, err := r.db(ctx).AIModel.Query().Where(aimodel.IsDefault(true)).Order(ent.Asc(aimodel.FieldID)).FirstID(ctx)
	if postgres.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find default ai model: %w", err)
	}
	return &id, nil
}

func (r *Repository) ModelTarget(ctx context.Context, id int) (ai.ModelTarget, []ai.RouteTarget, error) {
	row, err := r.db(ctx).AIModel.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return ai.ModelTarget{}, nil, ai.ErrModelNotFound
	}
	if err != nil {
		return ai.ModelTarget{}, nil, fmt.Errorf("get ai model %d: %w", id, err)
	}
	routes, err := r.db(ctx).AIRoute.Query().
		Where(airoute.ModelID(id), airoute.Status(string(ai.RouteActive)), airoute.HasProviderWith(aiprovider.Enabled(true))).
		WithProvider().
		Order(ent.Asc(airoute.FieldPriority), ent.Asc(airoute.FieldID)).
		All(ctx)
	if err != nil {
		return ai.ModelTarget{}, nil, fmt.Errorf("load ai model %d routes: %w", id, err)
	}
	targets := make([]ai.RouteTarget, 0, len(routes))
	for _, route := range routes {
		targets = append(targets, toRouteTarget(route))
	}
	return toModelTarget(row), targets, nil
}

func (r *Repository) RouteTarget(ctx context.Context, id int) (ai.ModelTarget, ai.RouteTarget, error) {
	row, err := r.db(ctx).AIRoute.Query().Where(airoute.ID(id)).WithModel().WithProvider().Only(ctx)
	if postgres.IsNotFound(err) {
		return ai.ModelTarget{}, ai.RouteTarget{}, ai.ErrRouteNotFound
	}
	if err != nil {
		return ai.ModelTarget{}, ai.RouteTarget{}, fmt.Errorf("get ai route %d: %w", id, err)
	}
	return toModelTarget(row.Edges.Model), toRouteTarget(row), nil
}

func (r *Repository) SuperAdminIDs(ctx context.Context) ([]int, error) {
	ids, err := r.db(ctx).User.Query().
		Where(entuser.Role(superAdminRole), entuser.Status(activeUserStatus)).
		Order(ent.Asc(entuser.FieldID)).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list super admins: %w", err)
	}
	return ids, nil
}
