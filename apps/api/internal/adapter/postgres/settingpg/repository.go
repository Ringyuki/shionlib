package settingpg

import (
	"context"
	"encoding/json"
	"fmt"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entsetting "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/settingchange"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
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

func (r *Repository) Values(ctx context.Context) ([]setting.StoredValue, error) {
	rows, err := r.db(ctx).Setting.Query().Order(ent.Asc(entsetting.FieldName)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list settings: %w", err)
	}
	values := make([]setting.StoredValue, len(rows))
	for i, row := range rows {
		values[i] = toStoredValue(row)
	}
	return values, nil
}

func (r *Repository) Value(ctx context.Context, name string) (setting.StoredValue, bool, error) {
	row, err := r.db(ctx).Setting.Query().Where(entsetting.Name(name)).Only(ctx)
	if postgres.IsNotFound(err) {
		return setting.StoredValue{}, false, nil
	}
	if err != nil {
		return setting.StoredValue{}, false, fmt.Errorf("get setting %s: %w", name, err)
	}
	return toStoredValue(row), true, nil
}

func (r *Repository) Save(ctx context.Context, name string, value json.RawMessage) error {
	err := r.db(ctx).Setting.Create().
		SetName(name).
		SetValue(value).
		OnConflictColumns(entsetting.FieldName).
		UpdateValue().
		UpdateUpdated().
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("save setting %s: %w", name, err)
	}
	return nil
}

func (r *Repository) Remove(ctx context.Context, name string) error {
	if _, err := r.db(ctx).Setting.Delete().Where(entsetting.Name(name)).Exec(ctx); err != nil {
		return fmt.Errorf("remove setting %s: %w", name, err)
	}
	return nil
}

func (r *Repository) Record(ctx context.Context, change setting.NewChange) error {
	create := r.db(ctx).SettingChange.Create().SetName(change.Name)
	if change.Previous != nil {
		create.SetPrevious(change.Previous)
	}
	if change.Value != nil {
		create.SetValue(change.Value)
	}
	if change.EditorID != 0 {
		create.SetActorID(change.EditorID)
	}
	if err := create.Exec(ctx); err != nil {
		return fmt.Errorf("record setting change %s: %w", change.Name, err)
	}
	return nil
}

func (r *Repository) LatestChanges(ctx context.Context) ([]setting.Change, error) {
	rows, err := r.db(ctx).SettingChange.Query().
		Where(func(s *sql.Selector) {
			changes := sql.Table(settingchange.Table)
			latest := sql.Select(sql.Max(changes.C(settingchange.FieldID))).From(changes).GroupBy(changes.C(settingchange.FieldName))
			s.Where(sql.In(s.C(settingchange.FieldID), latest))
		}).
		WithActor().
		Order(ent.Asc(settingchange.FieldName)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list latest setting changes: %w", err)
	}
	return toChanges(rows), nil
}

func (r *Repository) Changes(ctx context.Context, name string, page paging.Page) ([]setting.Change, int, error) {
	query := r.db(ctx).SettingChange.Query().Where(settingchange.Name(name))
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count setting changes %s: %w", name, err)
	}
	rows, err := query.
		WithActor().
		Order(ent.Desc(settingchange.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list setting changes %s: %w", name, err)
	}
	return toChanges(rows), total, nil
}
