package sitemappg_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sitemappg"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
)

func TestStoreListsPublicEntries(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	first := db.Game(t)
	db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })
	rated := db.Game(t)
	if err := db.Ent.GameCover.Create().SetGameID(rated).SetLanguage("jp").SetType("dig").SetURL("x").SetSexual(1).SetViolence(0).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	last := db.Game(t)
	if _, err := db.Ent.GameDeveloper.Create().SetName("dev").Save(ctx); err != nil {
		t.Fatal(err)
	}
	character, err := db.Ent.GameCharacter.Create().SetNameJp("c").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}

	store := sitemappg.NewStore(db.Ent)
	for section, want := range map[sitemap.Section]int{sitemap.SectionGame: 2, sitemap.SectionDeveloper: 1, sitemap.SectionCharacter: 1} {
		if count, err := store.Count(ctx, section); err != nil || count != want {
			t.Fatalf("%s count: %d %v", section, count, err)
		}
	}
	games, err := store.Entries(ctx, sitemap.SectionGame, 0, 10)
	if err != nil || len(games) != 2 || games[0].ID != first || games[1].ID != last || games[0].Updated.IsZero() {
		t.Fatalf("games: %+v %v", games, err)
	}
	second, err := store.Entries(ctx, sitemap.SectionGame, 1, 10)
	if err != nil || len(second) != 1 || second[0].ID != last {
		t.Fatalf("offset: %+v %v", second, err)
	}
	characters, err := store.Entries(ctx, sitemap.SectionCharacter, 0, 10)
	if err != nil || len(characters) != 1 || characters[0].ID != character.ID {
		t.Fatalf("characters: %+v %v", characters, err)
	}
}
