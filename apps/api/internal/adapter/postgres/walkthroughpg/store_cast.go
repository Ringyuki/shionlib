package walkthroughpg

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacterrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type CastStore struct {
	client *ent.Client
}

func NewCastStore(client *ent.Client) *CastStore {
	return &CastStore{client: client}
}

func (s *CastStore) Cast(ctx context.Context, gameID int) ([]walkthrough.CastMember, error) {
	rows, err := postgres.Client(ctx, s.client).GameCharacterRelation.Query().
		Where(gamecharacterrelation.GameID(gameID)).
		Order(gamecharacterrelation.ByID()).
		WithCharacter().
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load the cast of game %d: %w", gameID, err)
	}
	cast := make([]walkthrough.CastMember, 0, len(rows))
	for _, row := range rows {
		character := row.Edges.Character
		if character == nil {
			continue
		}
		names := []string{character.NameJp, deref(character.NameZh), deref(character.NameEn)}
		names = append(names, character.Aliases...)
		cast = append(cast, walkthrough.CastMember{ID: character.ID, Names: distinctNames(names)})
	}
	return cast, nil
}

func distinctNames(names []string) []string {
	kept := make([]string, 0, len(names))
	for _, name := range names {
		trimmed := strings.TrimSpace(name)
		if trimmed != "" && !slices.Contains(kept, trimmed) {
			kept = append(kept, trimmed)
		}
	}
	return kept
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
