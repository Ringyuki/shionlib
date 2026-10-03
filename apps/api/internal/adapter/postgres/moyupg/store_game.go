package moyupg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
)

type GameStore struct {
	client *ent.Client
}

func NewGameStore(client *ent.Client) *GameStore {
	return &GameStore{client: client}
}

func (g *GameStore) VNDBID(ctx context.Context, gameID int, viewer actor.Actor) (string, bool, error) {
	row, err := postgres.Client(ctx, g.client).Game.Query().
		Where(entgame.ID(gameID)).
		Where(gamepg.VisibleTo(viewer)...).
		Select(entgame.FieldVID).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("get vndb id of game %d: %w", gameID, err)
	}
	if row.VID == nil || *row.VID == "" {
		return "", false, nil
	}
	return *row.VID, true, nil
}
