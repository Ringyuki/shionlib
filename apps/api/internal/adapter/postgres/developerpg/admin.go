package developerpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloper"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
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
