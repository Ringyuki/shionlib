package moyupg_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestGame(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	games := moyupg.NewGameStore(db.Ent)
	strict := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitNeverShow}
	permissive := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitJustShow}
	released := time.Date(2016, 12, 28, 0, 0, 0, 0, time.UTC)

	both := db.Game(t, func(c *ent.GameCreate) {
		c.SetVID("v4145").SetBID(" 302835 ").SetTitleJp("みんなでニャンニャン").SetTitleZh(" ").SetTitleEn("Minna de Nyan Nyan").
			SetAliases(pgvalue.Strings{"にゃんにゃん"}).SetReleaseDate(released)
	})
	rated := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v17").SetNsfw(true) })
	titled := db.Game(t, func(c *ent.GameCreate) {
		c.SetVID("").SetTitleJp("プレミアムアーカイブス むとうけいじ").SetReleaseDate(released).SetReleaseDateTba(true)
	})

	game, ok, err := games.Game(ctx, both, strict)
	anchors := []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v4145"}, {Source: moyu.SourceBangumi, ID: "302835"}}
	if err != nil || !ok || !slices.Equal(game.Anchors, anchors) {
		t.Fatalf("vndb comes before bangumi: %+v %v %v", game, ok, err)
	}
	if !slices.Equal(game.Titles, []string{"みんなでニャンニャン", "Minna de Nyan Nyan", "にゃんにゃん"}) || game.Released == nil || !game.Released.Equal(released) {
		t.Fatalf("the original title comes first: %+v", game)
	}
	if _, ok, err := games.Game(ctx, rated, strict); err != nil || ok {
		t.Fatalf("strict viewers must not resolve rated games: %v %v", ok, err)
	}
	if game, ok, err := games.Game(ctx, rated, permissive); err != nil || !ok || !slices.Equal(game.Anchors, []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v17"}}) {
		t.Fatalf("permissive viewers resolve rated games: %+v %v %v", game, ok, err)
	}
	if game, ok, err := games.Game(ctx, titled, permissive); err != nil || !ok || len(game.Anchors) != 0 || game.SearchTitle() != "プレミアムアーカイブス むとうけいじ" || game.Released != nil {
		t.Fatalf("a game without external ids has its title, and a date still to be announced is none: %+v %v %v", game, ok, err)
	}
	if _, ok, err := games.Game(ctx, 987654, permissive); err != nil || ok {
		t.Fatalf("missing games: %v %v", ok, err)
	}
}
