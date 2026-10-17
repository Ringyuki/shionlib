package moyupg

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/patchpageassignment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type GameStore struct {
	client *ent.Client
}

func NewGameStore(client *ent.Client) *GameStore {
	return &GameStore{client: client}
}

func (g *GameStore) Game(ctx context.Context, gameID int, viewer actor.Actor) (moyu.Game, bool, error) {
	found, err := g.game(ctx, gameID, gamepg.VisibleTo(viewer)...)
	if errors.Is(err, game.ErrNotFound) {
		return moyu.Game{}, false, nil
	}
	return found, err == nil, err
}

func (g *GameStore) game(ctx context.Context, gameID int, visible ...predicate.Game) (moyu.Game, error) {
	db := postgres.Client(ctx, g.client)
	row, err := db.Game.Query().
		Where(entgame.ID(gameID)).
		Where(visible...).
		Select(entgame.FieldVID, entgame.FieldBID).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return moyu.Game{}, game.ErrNotFound
	}
	if err != nil {
		return moyu.Game{}, fmt.Errorf("get the external ids of game %d: %w", gameID, err)
	}
	found := moyu.Game{Anchors: []moyu.Anchor{}}
	for _, anchor := range []moyu.Anchor{{Source: moyu.SourceVNDB, ID: idOf(row.VID)}, {Source: moyu.SourceBangumi, ID: idOf(row.BID)}} {
		if anchor.ID != "" {
			found.Anchors = append(found.Anchors, anchor)
		}
	}
	assignment, err := db.PatchPageAssignment.Query().Where(patchpageassignment.GameID(gameID)).Only(ctx)
	if postgres.IsNotFound(err) {
		return found, nil
	}
	if err != nil {
		return moyu.Game{}, fmt.Errorf("get the patch pages assigned to game %d: %w", gameID, err)
	}
	found.Assigned, found.Pages = true, append([]string{}, assignment.PageIds...)
	return found, nil
}

func idOf(id *string) string {
	if id == nil {
		return ""
	}
	return strings.TrimSpace(*id)
}
