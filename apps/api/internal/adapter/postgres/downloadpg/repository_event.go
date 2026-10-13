package downloadpg

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourceevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const eventResourceFK = "game_download_resource_events_resource_id_fkey"

func (r *Repository) GetGameResource(ctx context.Context, id int, excludeRated bool) (download.GameResource, error) {
	query := r.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id))
	if excludeRated {
		query.Where(gamedownloadresource.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	rows, err := withFileDetails(query).All(ctx)
	if err != nil {
		return download.GameResource{}, fmt.Errorf("load download resource %d: %w", id, err)
	}
	if len(rows) == 0 {
		return download.GameResource{}, download.ErrResourceNotFound
	}
	resources, err := r.gameResources(ctx, rows)
	if err != nil {
		return download.GameResource{}, err
	}
	return resources[0], nil
}

func (r *Repository) CreateEvent(ctx context.Context, in download.NewEvent) error {
	data, err := json.Marshal(toEventRow(in.Data))
	if err != nil {
		return fmt.Errorf("encode event of download resource %d: %w", in.ResourceID, err)
	}
	err = r.db(ctx).GameDownloadResourceEvent.Create().
		SetResourceID(in.ResourceID).
		SetKind(string(in.Kind)).
		SetNillableActorID(in.ActorID).
		SetData(data).
		Exec(ctx)
	if postgres.IsForeignKeyViolation(err, eventResourceFK) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("record event of download resource %d: %w", in.ResourceID, err)
	}
	return nil
}

func (r *Repository) ListEvents(ctx context.Context, resourceID, limit int) ([]download.Event, error) {
	rows, err := r.db(ctx).GameDownloadResourceEvent.Query().
		Where(gamedownloadresourceevent.ResourceID(resourceID)).
		Order(ent.Desc(gamedownloadresourceevent.FieldCreated), ent.Desc(gamedownloadresourceevent.FieldID)).
		Limit(limit).
		WithActor(userpg.SelectSummary).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list events of download resource %d: %w", resourceID, err)
	}
	events := make([]download.Event, len(rows))
	for i, row := range rows {
		event, err := toEvent(row)
		if err != nil {
			return nil, err
		}
		events[i] = event
	}
	return events, nil
}
