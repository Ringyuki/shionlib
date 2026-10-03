package characterpg_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/characterpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamecharacter"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
)

func TestRepositoryContract(t *testing.T) {
	charactertest.RepositoryContract(t, func(t *testing.T) charactertest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		return charactertest.Env{
			Repo: characterpg.NewRepository(db.Ent),
			Seed: func(t *testing.T, c character.Character) int {
				create := db.Ent.GameCharacter.Create().
					SetNameJp(c.NameJP).
					SetNillableNameZh(c.NameZH).
					SetNillableNameEn(c.NameEN).
					SetAliases(pgvalue.Strings(c.Aliases)).
					SetIntroJp(c.IntroJP).
					SetNillableImage(c.Image).
					SetNillableHID(c.HID).
					SetNillableHeight(c.Height).
					SetNillableCup(c.Cup).
					SetNillableAge(c.Age).
					SetBirthday(pgvalue.Ints(c.Birthday)).
					SetGender(pgvalue.Strings(c.Gender))
				if c.BloodType != nil {
					create.SetBloodType(gamecharacter.BloodType(*c.BloodType))
				}
				row, err := create.Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return row.ID
			},
			Link: func(t *testing.T, characterID int) {
				if err := db.Ent.GameCharacterRelation.Create().SetGameID(db.Game(t)).SetCharacterID(characterID).Exec(t.Context()); err != nil {
					t.Fatal(err)
				}
			},
		}
	})
}

func TestAdminSearch(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := characterpg.NewRepository(db.Ent)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	seed := func(nameJP string, nameEN *string, offset time.Duration, mutate func(*ent.GameCharacterCreate)) int {
		create := db.Ent.GameCharacter.Create().SetNameJp(nameJP).SetNillableNameEn(nameEN).SetCreated(base.Add(offset)).SetUpdated(base.Add(-offset))
		if mutate != nil {
			mutate(create)
		}
		return create.SaveX(ctx).ID
	}
	sky := "Sky"
	soraID := seed("Sora", &sky, time.Hour, func(c *ent.GameCharacterCreate) {
		c.SetImage("c.webp").SetGender(pgvalue.Strings{"f"}).SetNameZh("小穹")
	})
	haruID := seed("Haru", nil, 2*time.Hour, nil)
	akiraID := seed("Akira", nil, 3*time.Hour, func(c *ent.GameCharacterCreate) { c.SetAliases(pgvalue.Strings{"sora alias"}) })
	for range 2 {
		db.Ent.GameCharacterRelation.Create().SetGameID(db.Game(t)).SetCharacterID(soraID).ExecX(ctx)
	}
	db.Ent.GameCharacterRelation.Create().SetGameID(db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })).SetCharacterID(haruID).ExecX(ctx)

	entries, total, err := repo.Search(ctx, character.AdminFilter{SortBy: character.SortByID, Descending: true}, character.Page{Number: 1, Size: 2})
	if err != nil || total != 3 || len(entries) != 2 || entries[0].ID != akiraID || entries[1].ID != haruID {
		t.Fatalf("first page: %+v %d %v", entries, total, err)
	}
	if entries[1].GamesCount != 1 || entries[0].GamesCount != 0 || entries[0].Gender == nil || len(entries[0].Gender) != 0 {
		t.Fatalf("counts include hidden games and gender is never nil: %+v", entries)
	}

	entries, total, err = repo.Search(ctx, character.AdminFilter{Search: "SKY", SortBy: character.SortByID}, character.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(entries) != 1 {
		t.Fatalf("names only, case-insensitive: %+v %d %v", entries, total, err)
	}
	got := entries[0]
	if got.ID != soraID || got.NameJP != "Sora" || got.NameZH == nil || *got.NameZH != "小穹" || got.NameEN == nil || *got.NameEN != "Sky" ||
		got.Image == nil || *got.Image != "c.webp" || !slices.Equal(got.Gender, []string{"f"}) || got.GamesCount != 2 ||
		!got.Created.Equal(base.Add(time.Hour)) || !got.Updated.Equal(base.Add(-time.Hour)) {
		t.Fatalf("entry %+v", got)
	}
	for _, keyword := range []string{"SORA", "小穹"} {
		entries, total, err := repo.Search(ctx, character.AdminFilter{Search: keyword, SortBy: character.SortByID}, character.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || len(entries) != 1 || entries[0].ID != soraID {
			t.Fatalf("search %q ignores aliases: %+v %d %v", keyword, entries, total, err)
		}
	}

	order := func(filter character.AdminFilter) []int {
		t.Helper()
		entries, _, err := repo.Search(ctx, filter, character.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		ids := make([]int, len(entries))
		for i, entry := range entries {
			ids[i] = entry.ID
		}
		return ids
	}
	if ids := order(character.AdminFilter{SortBy: character.SortByName}); !slices.Equal(ids, []int{akiraID, haruID, soraID}) {
		t.Fatalf("name sorts by name_jp: %v", ids)
	}
	if ids := order(character.AdminFilter{SortBy: character.SortByCreated, Descending: true}); !slices.Equal(ids, []int{akiraID, haruID, soraID}) {
		t.Fatalf("created desc: %v", ids)
	}
	if ids := order(character.AdminFilter{SortBy: character.SortByUpdated}); !slices.Equal(ids, []int{akiraID, haruID, soraID}) {
		t.Fatalf("updated asc: %v", ids)
	}
	if entries, total, err := repo.Search(ctx, character.AdminFilter{SortBy: character.SortByID}, character.Page{Number: 3, Size: 2}); err != nil || total != 3 || len(entries) != 0 {
		t.Fatalf("past the end: %+v %d %v", entries, total, err)
	}
}
