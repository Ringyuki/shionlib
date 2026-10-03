package moyupg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
)

func TestVNDBID(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	games := moyupg.NewGames(db.Ent)
	strict := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitNeverShow}
	permissive := actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitJustShow}

	safe := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v4145") })
	rated := db.Game(t, func(c *ent.GameCreate) { c.SetVID("v17").SetNsfw(true) })
	without := db.Game(t)

	if id, ok, err := games.VNDBID(ctx, safe, strict); err != nil || !ok || id != "v4145" {
		t.Fatalf("safe game: %q %v %v", id, ok, err)
	}
	if _, ok, err := games.VNDBID(ctx, rated, strict); err != nil || ok {
		t.Fatalf("strict viewers must not resolve rated games: %v %v", ok, err)
	}
	if id, ok, err := games.VNDBID(ctx, rated, permissive); err != nil || !ok || id != "v17" {
		t.Fatalf("permissive viewers resolve rated games: %q %v %v", id, ok, err)
	}
	if _, ok, err := games.VNDBID(ctx, without, permissive); err != nil || ok {
		t.Fatalf("games without a vndb id: %v %v", ok, err)
	}
	if _, ok, err := games.VNDBID(ctx, 987654, permissive); err != nil || ok {
		t.Fatalf("missing games: %v %v", ok, err)
	}
}
