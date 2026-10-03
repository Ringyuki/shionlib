package characterpg

import (
	"context"
	"fmt"
	"slices"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

var adminSortFields = map[character.SortField]string{
	character.SortByID:      gamecharacter.FieldID,
	character.SortByName:    gamecharacter.FieldNameJp,
	character.SortByCreated: gamecharacter.FieldCreated,
	character.SortByUpdated: gamecharacter.FieldUpdated,
}

func (r *Repository) Search(ctx context.Context, filter character.AdminFilter, page character.Page) ([]character.AdminEntry, int, error) {
	query := r.db(ctx).GameCharacter.Query()
	if filter.Search != "" {
		query.Where(gamecharacter.Or(
			gamecharacter.NameJpContainsFold(filter.Search),
			gamecharacter.NameZhContainsFold(filter.Search),
			gamecharacter.NameEnContainsFold(filter.Search),
		))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count characters: %w", err)
	}
	field, ok := adminSortFields[filter.SortBy]
	if !ok {
		field = gamecharacter.FieldID
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	rows, err := query.
		Select(
			gamecharacter.FieldID, gamecharacter.FieldNameJp, gamecharacter.FieldNameZh, gamecharacter.FieldNameEn,
			gamecharacter.FieldImage, gamecharacter.FieldGender, gamecharacter.FieldCreated, gamecharacter.FieldUpdated,
		).
		Order(order(field), order(gamecharacter.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search characters: %w", err)
	}
	counts, err := r.gameCounts(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]character.AdminEntry, len(rows))
	for i, row := range rows {
		gender := slices.Clone([]string(row.Gender))
		if gender == nil {
			gender = []string{}
		}
		entries[i] = character.AdminEntry{
			ID:         row.ID,
			NameJP:     row.NameJp,
			NameZH:     row.NameZh,
			NameEN:     row.NameEn,
			Image:      row.Image,
			Gender:     gender,
			GamesCount: counts[row.ID],
			Created:    row.Created,
			Updated:    row.Updated,
		}
	}
	return entries, total, nil
}

func (r *Repository) gameCounts(ctx context.Context, rows []*ent.GameCharacter) (map[int]int, error) {
	counts := map[int]int{}
	if len(rows) == 0 {
		return counts, nil
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var grouped []struct {
		CharacterID int `json:"character_id"`
		Count       int `json:"count"`
	}
	err := r.db(ctx).GameCharacterRelation.Query().
		Where(gamecharacterrelation.CharacterIDIn(ids...)).
		GroupBy(gamecharacterrelation.FieldCharacterID).
		Aggregate(ent.Count()).
		Scan(ctx, &grouped)
	if err != nil {
		return nil, fmt.Errorf("count character games: %w", err)
	}
	for _, g := range grouped {
		counts[g.CharacterID] = g.Count
	}
	return counts, nil
}
