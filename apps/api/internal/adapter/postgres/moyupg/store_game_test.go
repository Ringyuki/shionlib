package moyupg_test

import (
	"context"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestGame(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	games := moyupg.NewGameStore(db.Ent)
	strict := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitNeverShow}
	permissive := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitJustShow}

	both := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v4145").SetBID(" 302835 ") })
	rated := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v17").SetNsfw(true) })
	bangumi := db.Game(t, func(c *ent.GameCreate) { c.SetVID("").SetBID("700741") })
	assigned := db.Game(t)
	if err := moyupg.NewAssignmentStore(db.Ent).Assign(ctx, assigned, []string{"212857"}, 0); err != nil {
		t.Fatal(err)
	}

	game, ok, err := games.Game(ctx, both, strict)
	want := []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v4145"}, {Source: moyu.SourceBangumi, ID: "302835"}}
	if err != nil || !ok || !slices.Equal(game.Anchors, want) || game.Assigned {
		t.Fatalf("vndb comes before bangumi: %+v %v %v", game, ok, err)
	}
	if _, ok, err := games.Game(ctx, rated, strict); err != nil || ok {
		t.Fatalf("strict viewers must not resolve rated games: %v %v", ok, err)
	}
	if game, ok, err := games.Game(ctx, rated, permissive); err != nil || !ok || !slices.Equal(game.Anchors, []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v17"}}) {
		t.Fatalf("permissive viewers resolve rated games: %+v %v %v", game, ok, err)
	}
	if game, ok, err := games.Game(ctx, bangumi, permissive); err != nil || !ok || !slices.Equal(game.Anchors, []moyu.Anchor{{Source: moyu.SourceBangumi, ID: "700741"}}) {
		t.Fatalf("a game without a vndb id: %+v %v %v", game, ok, err)
	}
	if game, ok, err := games.Game(ctx, assigned, permissive); err != nil || !ok || len(game.Anchors) != 0 || !game.Assigned || !slices.Equal(game.Pages, []string{"212857"}) {
		t.Fatalf("a game whose pages were assigned by hand: %+v %v %v", game, ok, err)
	}
	if _, ok, err := games.Game(ctx, 987654, permissive); err != nil || ok {
		t.Fatalf("missing games: %v %v", ok, err)
	}
}
