package gamepg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecover"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedeveloperrelation"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const developerRole = "开发"

type CardStore struct {
	client *ent.Client
}

func NewCardStore(client *ent.Client) *CardStore {
	return &CardStore{client: client}
}

func (s *CardStore) Cards(ctx context.Context, ids []int) ([]game.Card, error) {
	rows, err := postgres.Client(ctx, s.client).Game.Query().
		Where(entgame.IDIn(ids...)).
		WithCovers(func(q *ent.GameCoverQuery) {
			q.Order(ent.Asc(gamecover.FieldID))
		}).
		WithDevelopers(func(q *ent.GameDeveloperRelationQuery) {
			q.Where(gamedeveloperrelation.RoleEQ(developerRole)).Order(ent.Asc(gamedeveloperrelation.FieldID)).WithDeveloper()
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load game cards: %w", err)
	}
	cards := make([]game.Card, 0, len(rows))
	for _, row := range rows {
		cards = append(cards, toCard(row))
	}
	return cards, nil
}

func (s *CardStore) Exists(ctx context.Context, id int) (bool, error) {
	exists, err := postgres.Client(ctx, s.client).Game.Query().Where(entgame.ID(id)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check game existence: %w", err)
	}
	return exists, nil
}
