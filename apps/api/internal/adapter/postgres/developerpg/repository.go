package developerpg

import (
	"context"
	"fmt"
	"slices"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

var adminSortFields = map[developer.SortField]string{
	developer.SortByID:      gamedeveloper.FieldID,
	developer.SortByName:    gamedeveloper.FieldName,
	developer.SortByCreated: gamedeveloper.FieldCreated,
	developer.SortByUpdated: gamedeveloper.FieldUpdated,
}

func (r *Repository) Search(ctx context.Context, filter developer.AdminFilter, page developer.Page) ([]developer.AdminEntry, int, error) {
	query := r.db(ctx).GameDeveloper.Query()
	if filter.Search != "" {
		query.Where(gamedeveloper.NameContainsFold(filter.Search))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count developers: %w", err)
	}
	field, ok := adminSortFields[filter.SortBy]
	if !ok {
		field = gamedeveloper.FieldID
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := query.
		Select(gamedeveloper.FieldID, gamedeveloper.FieldName, gamedeveloper.FieldLogo, gamedeveloper.FieldCreated, gamedeveloper.FieldUpdated).
		Order(order(field), order(gamedeveloper.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search developers: %w", err)
	}
	counts, err := r.gameCounts(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]developer.AdminEntry, len(rows))
	for i, row := range rows {
		entries[i] = developer.AdminEntry{
			ID:         row.ID,
			Name:       row.Name,
			Logo:       row.Logo,
			GamesCount: counts[row.ID],
			Created:    row.Created,
			Updated:    row.Updated,
		}
	}
	return entries, total, nil
}

func (r *Repository) gameCounts(ctx context.Context, rows []*ent.GameDeveloper) (map[int]int, error) {
	counts := map[int]int{}
	if len(rows) == 0 {
		return counts, nil
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var grouped []struct {
		DeveloperID int `json:"developer_id"`
		Count       int `json:"count"`
	}
	err := r.db(ctx).GameDeveloperRelation.Query().
		Where(gamedeveloperrelation.DeveloperIDIn(ids...)).
		GroupBy(gamedeveloperrelation.FieldDeveloperID).
		Aggregate(ent.Count()).
		Scan(ctx, &grouped)
	if err != nil {
		return nil, fmt.Errorf("count developer games: %w", err)
	}
	for _, g := range grouped {
		counts[g.DeveloperID] = g.Count
	}
	return counts, nil
}

const relationDeveloperFK = "game_developer_relations_developer_id_fkey"

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func matching(query string) predicate.GameDeveloper {
	return predicate.GameDeveloper(func(s *sql.Selector) {
		s.Where(sql.Or(
			sql.ContainsFold(s.C(gamedeveloper.FieldName), query),
			gamepg.AnyElementContainsFold(s.C(gamedeveloper.FieldAliases), query),
		))
	})
}

func (r *Repository) List(ctx context.Context, query string, page developer.Page) ([]developer.Summary, int, error) {
	q := r.db(ctx).GameDeveloper.Query()
	if query != "" {
		q.Where(matching(query))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count developers: %w", err)
	}
	rows, err := q.Order(gamedeveloper.ByName(), gamedeveloper.ByID()).Offset(page.Offset()).Limit(page.Size).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list developers: %w", err)
	}
	works, err := r.worksCount(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	summaries := make([]developer.Summary, len(rows))
	for i, row := range rows {
		summaries[i] = developer.Summary{ID: row.ID, Name: row.Name, Aliases: nonNil(row.Aliases), Logo: row.Logo, WorksCount: works[row.ID]}
	}
	return summaries, total, nil
}

func (r *Repository) worksCount(ctx context.Context, rows []*ent.GameDeveloper) (map[int]int, error) {
	counts := map[int]int{}
	if len(rows) == 0 {
		return counts, nil
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var grouped []struct {
		DeveloperID int `json:"developer_id"`
		Count       int `json:"count"`
	}
	err := r.db(ctx).GameDeveloperRelation.Query().
		Where(gamedeveloperrelation.DeveloperIDIn(ids...), gamedeveloperrelation.HasGameWith(entgame.Status(1))).
		GroupBy(gamedeveloperrelation.FieldDeveloperID).
		Aggregate(ent.Count()).
		Scan(ctx, &grouped)
	if err != nil {
		return nil, fmt.Errorf("count developer works: %w", err)
	}
	for _, g := range grouped {
		counts[g.DeveloperID] = g.Count
	}
	return counts, nil
}

func (r *Repository) Get(ctx context.Context, id int) (developer.Developer, error) {
	row, err := r.db(ctx).GameDeveloper.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return developer.Developer{}, developer.ErrNotFound
	}
	if err != nil {
		return developer.Developer{}, fmt.Errorf("get developer %d: %w", id, err)
	}
	return toDeveloper(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (developer.Developer, error) {
	row, err := r.db(ctx).GameDeveloper.Query().Where(gamedeveloper.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return developer.Developer{}, developer.ErrNotFound
	}
	if err != nil {
		return developer.Developer{}, fmt.Errorf("lock developer %d: %w", id, err)
	}
	return toDeveloper(row), nil
}

func (r *Repository) HasRelations(ctx context.Context, id int) (bool, error) {
	exists, err := r.db(ctx).GameDeveloperRelation.Query().Where(gamedeveloperrelation.DeveloperID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check relations of developer %d: %w", id, err)
	}
	return exists, nil
}

func (r *Repository) HasChildren(ctx context.Context, id int) (bool, error) {
	exists, err := r.db(ctx).GameDeveloper.Query().Where(gamedeveloper.ParentDeveloperID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check children of developer %d: %w", id, err)
	}
	return exists, nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).GameDeveloper.DeleteOneID(id).Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return developer.ErrNotFound
	case postgres.IsForeignKeyViolation(err, relationDeveloperFK):
		return developer.ErrHasRelations
	case err != nil:
		return fmt.Errorf("delete developer %d: %w", id, err)
	}
	return nil
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return slices.Clone(values)
}
