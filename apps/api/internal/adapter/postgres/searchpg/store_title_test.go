package searchpg_test

import (
	"context"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

func TestTitlesMatchPrefixesOfVisibleGamesByHeat(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	titles := searchpg.NewTitleStore(db.Ent)
	db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("サクラノ詩").SetTitleZh("樱之诗").SetHotScore(5) })
	db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("サクラノ刻").SetHotScore(9) })
	db.Game(t, func(c *ent.GameCreate) {
		c.SetTitleJp("千恋＊万花").SetTitleEn("Senren Banka").SetAliases(pgvalue.Strings{"さくら色の恋", "Sakura Romance"}).SetHotScore(7)
	})
	db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("サクラ隠し").SetStatus(2).SetHotScore(100) })
	db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("サクラ成人").SetNsfw(true).SetHotScore(50) })
	db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("100%_off").SetHotScore(1) })

	strict := game.Visibility{ExcludeRated: true}
	got, err := titles.Titles(ctx, "サクラ", strict, 10)
	if err != nil || !slices.Equal(got, []string{"サクラノ刻", "サクラノ詩"}) {
		t.Fatalf("hidden and rated games are skipped, hotter first: %v %v", got, err)
	}
	if got, _ := titles.Titles(ctx, "サクラ", game.Visibility{}, 10); !slices.Equal(got, []string{"サクラ成人", "サクラノ刻", "サクラノ詩"}) {
		t.Fatalf("rated games are suggested to permissive viewers: %v", got)
	}
	if got, _ := titles.Titles(ctx, "sakura", strict, 10); !slices.Equal(got, []string{"Sakura Romance"}) {
		t.Fatalf("aliases match case-insensitively: %v", got)
	}
	if got, _ := titles.Titles(ctx, "樱", strict, 10); !slices.Equal(got, []string{"樱之诗"}) {
		t.Fatalf("translated titles match: %v", got)
	}
	if got, _ := titles.Titles(ctx, "サクラ", strict, 1); !slices.Equal(got, []string{"サクラノ刻"}) {
		t.Fatalf("limit: %v", got)
	}
	if got, _ := titles.Titles(ctx, "100%", strict, 10); !slices.Equal(got, []string{"100%_off"}) {
		t.Fatalf("wildcards are literal: %v", got)
	}
	if got, _ := titles.Titles(ctx, "%", strict, 10); len(got) != 0 {
		t.Fatalf("a bare wildcard matches nothing: %v", got)
	}
}
