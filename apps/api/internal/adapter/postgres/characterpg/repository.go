package characterpg

import (
	"context"
	"fmt"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
)

const relationCharacterFK = "game_character_relations_character_id_fkey"

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func matching(query string) predicate.GameCharacter {
	return predicate.GameCharacter(func(s *sql.Selector) {
		s.Where(sql.Or(
			sql.ContainsFold(s.C(gamecharacter.FieldNameJp), query),
			sql.ContainsFold(s.C(gamecharacter.FieldNameZh), query),
			sql.ContainsFold(s.C(gamecharacter.FieldNameEn), query),
			gamepg.AnyElementContainsFold(s.C(gamecharacter.FieldAliases), query),
		))
	})
}

func (r *Repository) List(ctx context.Context, query string, page character.Page) ([]character.Character, int, error) {
	q := r.db(ctx).GameCharacter.Query()
	if query != "" {
		q.Where(matching(query))
	}
	total, err := q.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count characters: %w", err)
	}
	rows, err := q.Order(gamecharacter.ByID()).Offset(page.Offset()).Limit(page.Size).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list characters: %w", err)
	}
	characters := make([]character.Character, len(rows))
	for i, row := range rows {
		characters[i] = gamepg.ToCharacter(row)
	}
	return characters, total, nil
}

func (r *Repository) Get(ctx context.Context, id int) (character.Character, error) {
	row, err := r.db(ctx).GameCharacter.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return character.Character{}, character.ErrNotFound
	}
	if err != nil {
		return character.Character{}, fmt.Errorf("get character %d: %w", id, err)
	}
	return gamepg.ToCharacter(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (character.Character, error) {
	row, err := r.db(ctx).GameCharacter.Query().Where(gamecharacter.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return character.Character{}, character.ErrNotFound
	}
	if err != nil {
		return character.Character{}, fmt.Errorf("lock character %d: %w", id, err)
	}
	return gamepg.ToCharacter(row), nil
}

func (r *Repository) HasRelations(ctx context.Context, id int) (bool, error) {
	exists, err := r.db(ctx).GameCharacterRelation.Query().Where(gamecharacterrelation.CharacterID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check relations of character %d: %w", id, err)
	}
	return exists, nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).GameCharacter.DeleteOneID(id).Exec(ctx)
	switch {
	case postgres.IsNotFound(err):
		return character.ErrNotFound
	case postgres.IsForeignKeyViolation(err, relationCharacterFK):
		return character.ErrHasRelations
	case err != nil:
		return fmt.Errorf("delete character %d: %w", id, err)
	}
	return nil
}
