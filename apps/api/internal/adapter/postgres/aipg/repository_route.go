package aipg

import (
	"context"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/aiprovider"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airoute"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/airouteadjustment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

func (r *Repository) routeQuery(ctx context.Context) *ent.AIRouteQuery {
	return r.db(ctx).AIRoute.Query().
		WithModel().
		WithProvider().
		WithAdjustments(func(q *ent.AIRouteAdjustmentQuery) {
			q.Order(ent.Desc(airouteadjustment.FieldCreated), ent.Desc(airouteadjustment.FieldID))
		})
}

func (r *Repository) ListRoutes(ctx context.Context, filter ai.RouteFilter) ([]ai.Route, error) {
	query := r.routeQuery(ctx)
	if filter.IDs != nil {
		query.Where(airoute.IDIn(filter.IDs...))
	}
	if filter.ModelID != nil {
		query.Where(airoute.ModelID(*filter.ModelID))
	}
	if filter.ProviderID != nil {
		query.Where(airoute.ProviderID(*filter.ProviderID))
	}
	if filter.Status != nil {
		query.Where(airoute.Status(string(*filter.Status)))
	}
	rows, err := query.Order(ent.Asc(airoute.FieldPriority), ent.Asc(airoute.FieldID)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list ai routes: %w", err)
	}
	routes := make([]ai.Route, len(rows))
	for i, row := range rows {
		routes[i] = toRoute(row)
	}
	return routes, nil
}

func (r *Repository) GetRoute(ctx context.Context, id int) (ai.Route, error) {
	row, err := r.routeQuery(ctx).Where(airoute.ID(id)).Only(ctx)
	if postgres.IsNotFound(err) {
		return ai.Route{}, ai.ErrRouteNotFound
	}
	if err != nil {
		return ai.Route{}, fmt.Errorf("get ai route %d: %w", id, err)
	}
	return toRoute(row), nil
}

func (r *Repository) CreateRoute(ctx context.Context, in ai.NewRoute) (int, error) {
	tiers, err := encodeTiers(in.Price.Tiers)
	if err != nil {
		return 0, err
	}
	create := r.db(ctx).AIRoute.Create().
		SetModelID(in.ModelID).
		SetProviderID(in.ProviderID).
		SetUpstreamID(in.UpstreamID).
		SetProtocol(string(in.Protocol)).
		SetPriceManual(in.PriceManual).
		SetInputPrice(in.Price.Input).
		SetOutputPrice(in.Price.Output).
		SetNillableCacheReadPrice(in.Price.CacheRead).
		SetNillableCacheWritePrice(in.Price.CacheWrite).
		SetDroppedParams(pgvalue.Strings{}).
		SetPriority(in.Priority).
		SetStatus(string(ai.RouteActive))
	if tiers != nil {
		create.SetPriceTiers(tiers)
	}
	row, err := create.Save(ctx)
	if err != nil {
		return 0, translateRoute(err, "create ai route")
	}
	return row.ID, nil
}

func (r *Repository) UpdateRoute(ctx context.Context, id int, changes ai.RouteChanges) error {
	update := r.db(ctx).AIRoute.UpdateOneID(id)
	if changes.UpstreamID != nil {
		update.SetUpstreamID(*changes.UpstreamID)
	}
	if changes.Protocol != nil {
		update.SetProtocol(string(*changes.Protocol))
	}
	if changes.PriceManual != nil {
		update.SetPriceManual(*changes.PriceManual)
	}
	if price := changes.Price; price != nil {
		tiers, err := encodeTiers(price.Tiers)
		if err != nil {
			return err
		}
		update.SetInputPrice(price.Input).SetOutputPrice(price.Output)
		if price.CacheRead == nil {
			update.ClearCacheReadPrice()
		} else {
			update.SetCacheReadPrice(*price.CacheRead)
		}
		if price.CacheWrite == nil {
			update.ClearCacheWritePrice()
		} else {
			update.SetCacheWritePrice(*price.CacheWrite)
		}
		if tiers == nil {
			update.ClearPriceTiers()
		} else {
			update.SetPriceTiers(tiers)
		}
	}
	if changes.DroppedParams != nil {
		update.SetDroppedParams(pgvalue.Strings(nonNil(*changes.DroppedParams)))
	}
	if changes.JSONMode != nil {
		update.SetJSONMode(*changes.JSONMode)
	}
	if _, err := update.Save(ctx); err != nil {
		return translateRoute(err, fmt.Sprintf("update ai route %d", id))
	}
	return nil
}

func translateRoute(err error, action string) error {
	switch {
	case postgres.IsNotFound(err):
		return ai.ErrRouteNotFound
	case postgres.IsUniqueViolation(err, uniqueRoute):
		return ai.ErrRouteTaken
	case postgres.IsForeignKeyViolation(err, routeModelFK):
		return ai.ErrModelNotFound
	case postgres.IsForeignKeyViolation(err, routeProviderFK):
		return ai.ErrProviderNotFound
	}
	return fmt.Errorf("%s: %w", action, err)
}

func (r *Repository) DeleteRoutes(ctx context.Context, ids []int) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	count, err := r.db(ctx).AIRoute.Delete().Where(airoute.IDIn(ids...)).Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("delete ai routes: %w", err)
	}
	return count, nil
}

func (r *Repository) SetRouteStatus(ctx context.Context, ids []int, status ai.RouteStatus, at time.Time) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	count, err := r.db(ctx).AIRoute.Update().
		Where(airoute.IDIn(ids...)).
		SetStatus(string(status)).
		ClearStatusKind().
		ClearStatusMessage().
		SetStatusAt(at.UTC()).
		Save(ctx)
	if err != nil {
		return 0, fmt.Errorf("set ai route status: %w", err)
	}
	return count, nil
}

func (r *Repository) SetRoutePriorities(ctx context.Context, ids []int) error {
	for priority, id := range ids {
		if _, err := r.db(ctx).AIRoute.UpdateOneID(id).SetPriority(priority).Save(ctx); err != nil {
			return translateRoute(err, fmt.Sprintf("reorder ai route %d", id))
		}
	}
	return nil
}

func (r *Repository) NextRoutePriority(ctx context.Context, modelID int) (int, error) {
	row, err := r.db(ctx).AIRoute.Query().
		Where(airoute.ModelID(modelID)).
		Order(ent.Desc(airoute.FieldPriority)).
		First(ctx)
	if postgres.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("find next ai route priority: %w", err)
	}
	return row.Priority + 1, nil
}

func (r *Repository) SuspendRoute(ctx context.Context, id int, failure ai.Failure, at time.Time) (bool, error) {
	count, err := r.db(ctx).AIRoute.Update().
		Where(airoute.ID(id), airoute.Status(string(ai.RouteActive))).
		SetStatus(string(ai.RouteSuspended)).
		SetStatusKind(string(failure.Kind)).
		SetStatusMessage(clip(failure.Message, maxStatusMessage)).
		SetStatusAt(at.UTC()).
		Save(ctx)
	if err != nil {
		return false, fmt.Errorf("suspend ai route %d: %w", id, err)
	}
	return count > 0, nil
}

func (r *Repository) RecoverRoute(ctx context.Context, id int, at time.Time) (bool, error) {
	count, err := r.db(ctx).AIRoute.Update().
		Where(airoute.ID(id), airoute.Status(string(ai.RouteSuspended))).
		SetStatus(string(ai.RouteActive)).
		ClearStatusKind().
		ClearStatusMessage().
		SetStatusAt(at.UTC()).
		Save(ctx)
	if err != nil {
		return false, fmt.Errorf("recover ai route %d: %w", id, err)
	}
	return count > 0, nil
}

func (r *Repository) SuspendedRouteIDs(ctx context.Context) ([]int, error) {
	ids, err := r.db(ctx).AIRoute.Query().
		Where(airoute.Status(string(ai.RouteSuspended)), airoute.HasProviderWith(aiprovider.Enabled(true))).
		Order(ent.Asc(airoute.FieldStatusAt), ent.Asc(airoute.FieldID)).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list suspended ai routes: %w", err)
	}
	return ids, nil
}

func (r *Repository) SaveAdjustments(ctx context.Context, routeID int, adjustments []ai.NewAdjustment) error {
	for _, adjustment := range adjustments {
		err := r.db(ctx).AIRouteAdjustment.Create().
			SetRouteID(routeID).
			SetKind(string(adjustment.Kind)).
			SetValue(adjustment.Value).
			SetNillablePrevious(adjustment.Previous).
			SetErrorKind(string(adjustment.ErrorKind)).
			SetNillableRequestID(adjustment.RequestID).
			SetCreated(time.Now().UTC()).
			OnConflict(
				entsql.ConflictColumns(airouteadjustment.FieldRouteID, airouteadjustment.FieldKind, airouteadjustment.FieldValue),
				entsql.ResolveWith(func(set *entsql.UpdateSet) {
					set.SetExcluded(airouteadjustment.FieldErrorKind)
					set.SetExcluded(airouteadjustment.FieldRequestID)
					set.SetExcluded(airouteadjustment.FieldCreated)
				}),
			).
			Exec(ctx)
		switch {
		case postgres.IsForeignKeyViolation(err, adjustmentRouteFK):
			return ai.ErrRouteNotFound
		case postgres.IsForeignKeyViolation(err, adjustmentRequestFK):
			return ai.ErrRequestNotFound
		case err != nil:
			return fmt.Errorf("save ai route %d adjustment: %w", routeID, err)
		}
	}
	return nil
}

func (r *Repository) DeleteAdjustment(ctx context.Context, routeID, id int) error {
	count, err := r.db(ctx).AIRouteAdjustment.Delete().
		Where(airouteadjustment.ID(id), airouteadjustment.RouteID(routeID)).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("delete ai route adjustment %d: %w", id, err)
	}
	if count == 0 {
		return ai.ErrAdjustmentNotFound
	}
	return nil
}

func (r *Repository) DeleteAdjustmentsOfKind(ctx context.Context, routeID int, kind ai.AdjustmentKind) error {
	if _, err := r.db(ctx).AIRouteAdjustment.Delete().
		Where(airouteadjustment.RouteID(routeID), airouteadjustment.Kind(string(kind))).
		Exec(ctx); err != nil {
		return fmt.Errorf("delete ai route %d %s adjustments: %w", routeID, kind, err)
	}
	return nil
}
