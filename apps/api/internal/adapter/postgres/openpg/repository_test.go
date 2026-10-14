package openpg_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/openpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/open/opentest"
)

func TestGamesContract(t *testing.T) {
	opentest.GamesContract(t, func(t *testing.T) opentest.Env {
		db := pgtest.New(t)
		return opentest.Env{
			Games: openpg.NewRepository(db.Ent),
			AddGame: func(t *testing.T, g open.Game, hidden bool) int {
				status := game.StatusVisible
				if hidden {
					status = game.StatusHidden
				}
				return db.Game(t, func(create *ent.GameCreate) {
					create.SetNillableHID(g.HID).SetNillableBID(g.BID).SetNillableVID(g.VID).SetTitleJp(g.TitleJP).SetNsfw(g.NSFW).SetStatus(int(status))
				})
			},
		}
	})
}
