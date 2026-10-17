package moyupg

import (
	"context"
	"fmt"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

type GameStore struct {
	client *ent.Client
}

func NewGameStore(client *ent.Client) *GameStore {
	return &GameStore{client: client}
}

func (g *GameStore) Game(ctx context.Context, gameID int, viewer actor.Actor) (moyu.Game, bool, error) {
	row, err := postgres.Client(ctx, g.client).Game.Query().
		Where(entgame.ID(gameID)).
		Where(gamepg.VisibleTo(viewer)...).
		Select(entgame.FieldVID, entgame.FieldBID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn, entgame.FieldAliases, entgame.FieldReleaseDate, entgame.FieldReleaseDateTba).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return moyu.Game{}, false, nil
	}
	if err != nil {
		return moyu.Game{}, false, fmt.Errorf("get the ids and titles of game %d: %w", gameID, err)
	}
	game := moyu.Game{Anchors: []moyu.Anchor{}, Titles: []string{}}
	for _, anchor := range []moyu.Anchor{{Source: moyu.SourceVNDB, ID: idOf(row.VID)}, {Source: moyu.SourceBangumi, ID: idOf(row.BID)}} {
		if anchor.ID != "" {
			game.Anchors = append(game.Anchors, anchor)
		}
	}
	for _, title := range append([]string{row.TitleJp, row.TitleZh, row.TitleEn}, row.Aliases...) {
		if title = strings.TrimSpace(title); title != "" {
			game.Titles = append(game.Titles, title)
		}
	}
	if !row.ReleaseDateTba {
		game.Released = row.ReleaseDate
	}
	return game, true, nil
}

func idOf(id *string) string {
	if id == nil {
		return ""
	}
	return strings.TrimSpace(*id)
}
