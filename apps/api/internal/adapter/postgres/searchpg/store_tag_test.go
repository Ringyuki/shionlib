package searchpg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
)

func TestTagsMatchNamesAndAliasesByCount(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	tags := searchpg.NewTagStore(db.Ent)
	for i := range 3 {
		if _, err := db.Ent.Tag.Create().SetName("tag" + string(rune('a'+i))).SetCount(i).Save(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Ent.Tag.Create().SetName("Romance").SetAliases(pgvalue.Strings{"恋爱", "senren-like"}).Save(ctx); err != nil {
		t.Fatal(err)
	}
	all, err := tags.Tags(ctx, "", 2)
	if err != nil || len(all) != 2 || all[0].Name != "tagc" || all[1].Name != "tagb" {
		t.Fatalf("tags by count: %+v %v", all, err)
	}
	matched, err := tags.Tags(ctx, "恋", 10)
	if err != nil || len(matched) != 1 || matched[0].Name != "Romance" || len(matched[0].Aliases) != 2 {
		t.Fatalf("alias match: %+v %v", matched, err)
	}
	if byName, _ := tags.Tags(ctx, "ROMA", 10); len(byName) != 1 {
		t.Fatalf("names match case-insensitively: %+v", byName)
	}
}
