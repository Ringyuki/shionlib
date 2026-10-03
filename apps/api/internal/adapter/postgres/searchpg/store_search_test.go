package searchpg_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func hitIDs(t *testing.T, result search.Result, err error) []int {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
	ids := make([]int, len(result.Hits))
	for i, hit := range result.Hits {
		ids[i] = hit.GameID
	}
	return ids
}

func TestEngineMatchesTitlesAliasesTagsAndDevelopers(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	released := func(year int) func(*ent.GameCreate) {
		return func(c *ent.GameCreate) { c.SetReleaseDate(time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)) }
	}
	byTitle := db.Game(t, released(2020), func(c *ent.GameCreate) { c.SetTitleZh("千恋＊万花") })
	byAlias := db.Game(t, released(2021), func(c *ent.GameCreate) { c.SetAliases(pgvalue.Strings{"Senren Banka"}) })
	byTag := db.Game(t, released(2022))
	byDeveloper := db.Game(t, released(2023))
	rated := db.Game(t, released(2024), func(c *ent.GameCreate) { c.SetTitleEn("SENREN after").SetNsfw(true) })
	hidden := db.Game(t, func(c *ent.GameCreate) { c.SetTitleEn("senren hidden").SetStatus(2) })
	wildcard := db.Game(t, func(c *ent.GameCreate) { c.SetTitleEn("100% pure") })

	tagRow, err := db.Ent.Tag.Create().SetName("Romance").SetAliases(pgvalue.Strings{"恋爱", "senren-like"}).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ent.GameTagRelation.Create().SetGameID(byTag).SetTagID(tagRow.ID).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	dev, err := db.Ent.GameDeveloper.Create().SetName("ゆずソフト").SetAliases(pgvalue.Strings{"Senren Studio"}).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ent.GameDeveloperRelation.Create().SetGameID(byDeveloper).SetDeveloperID(dev.ID).SetRole("开发").Exec(ctx); err != nil {
		t.Fatal(err)
	}

	engine := searchpg.NewSearchStore(db.Ent)
	page := search.Page{Number: 1, Size: 10}
	find := func(criteria search.Criteria) []int {
		result, err := engine.Search(ctx, criteria)
		return hitIDs(t, result, err)
	}
	result, err := engine.Search(ctx, search.Criteria{Q: "senren", Page: page})
	if got := hitIDs(t, result, err); !slices.Equal(got, []int{rated, byDeveloper, byTag, byAlias}) || result.Total != 4 || result.TotalPages != 1 {
		t.Fatalf("keyword hits newest first: %v %+v (hidden %d)", got, result, hidden)
	}
	result, err = engine.Search(ctx, search.Criteria{Q: "senren", Page: search.Page{Number: 2, Size: 3}, ExcludeRated: true})
	if got := hitIDs(t, result, err); !slices.Equal(got, []int{}) || result.Total != 3 || result.TotalPages != 1 {
		t.Fatalf("strict viewers and paging: %v %+v", got, result)
	}
	if got := find(search.Criteria{Q: "万花", Page: page}); !slices.Equal(got, []int{byTitle}) {
		t.Fatalf("cjk substring: %v", got)
	}
	if got := find(search.Criteria{Q: "恋爱", Page: page}); !slices.Equal(got, []int{byTag}) {
		t.Fatalf("tag alias: %v", got)
	}
	if got := find(search.Criteria{Tag: "romance", Page: page}); !slices.Equal(got, []int{byTag}) {
		t.Fatalf("exact tag filter: %v", got)
	}
	if got := find(search.Criteria{Q: "senren", Tag: "Romance", Page: page}); !slices.Equal(got, []int{byTag}) {
		t.Fatalf("keyword and tag: %v", got)
	}
	if got := find(search.Criteria{Q: "100%", Page: page}); !slices.Equal(got, []int{wildcard}) {
		t.Fatalf("percent is literal: %v", got)
	}
	if got := find(search.Criteria{Q: "senren", OnlyWithResources: true, Page: page}); len(got) != 0 {
		t.Fatalf("resource filter: %v", got)
	}

	tags := searchpg.NewTagStore(db.Ent)
	for i := range 3 {
		if _, err := db.Ent.Tag.Create().SetName("tag" + string(rune('a'+i))).SetCount(i).Save(ctx); err != nil {
			t.Fatal(err)
		}
	}
	all, err := tags.Tags(ctx, "", 2)
	if err != nil || len(all) != 2 || all[0].Name != "tagc" || all[1].Name != "tagb" {
		t.Fatalf("tags by count: %+v %v", all, err)
	}
	matched, err := tags.Tags(ctx, "恋", 10)
	if err != nil || len(matched) != 1 || matched[0].Name != "Romance" || len(matched[0].Aliases) != 2 {
		t.Fatalf("alias match: %+v %v", matched, err)
	}
}
