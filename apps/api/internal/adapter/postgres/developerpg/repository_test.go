package developerpg_test

import (
	"context"
	"encoding/json"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/developerpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
)

func TestRepositoryContract(t *testing.T) {
	developertest.RepositoryContract(t, func(t *testing.T) developertest.Env {
		db := pgtest.New(t)
		ctx := context.Background()
		return developertest.Env{
			Repo: developerpg.NewRepository(db.Ent),
			Seed: func(t *testing.T, d developer.Developer) int {
				create := db.Ent.GameDeveloper.Create().
					SetName(d.Name).
					SetAliases(pgvalue.Strings(d.Aliases)).
					SetNillableLogo(d.Logo).
					SetIntroJp(d.IntroJP).
					SetIntroZh(d.IntroZH).
					SetIntroEn(d.IntroEN).
					SetNillableWebsite(d.Website).
					SetNillableHID(d.HID).
					SetNillableParentDeveloperID(d.ParentID)
				if d.ExtraInfo != nil {
					entries := make([]map[string]string, len(d.ExtraInfo))
					for i, entry := range d.ExtraInfo {
						entries[i] = map[string]string{"key": entry.Key, "value": entry.Value}
					}
					raw, _ := json.Marshal(entries)
					create.SetExtraInfo(raw)
				}
				row, err := create.Save(ctx)
				if err != nil {
					t.Fatal(err)
				}
				return row.ID
			},
			Link: func(t *testing.T, developerID int, hidden bool) {
				status := 1
				if hidden {
					status = 2
				}
				gameID := db.Game(t, func(c *ent.GameCreate) { c.SetStatus(status) })
				if err := db.Ent.GameDeveloperRelation.Create().SetGameID(gameID).SetDeveloperID(developerID).Exec(t.Context()); err != nil {
					t.Fatal(err)
				}
			},
		}
	})
}

func TestAdminSearch(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	repo := developerpg.NewRepository(db.Ent)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	seed := func(name string, offset time.Duration, mutate func(*ent.GameDeveloperCreate)) int {
		create := db.Ent.GameDeveloper.Create().SetName(name).SetCreated(base.Add(offset)).SetUpdated(base.Add(-offset))
		if mutate != nil {
			mutate(create)
		}
		return create.SaveX(ctx).ID
	}
	yuzuID := seed("Yuzusoft", time.Hour, func(c *ent.GameDeveloperCreate) { c.SetLogo("logo.webp") })
	keyID := seed("Key", 2*time.Hour, func(c *ent.GameDeveloperCreate) { c.SetAliases(pgvalue.Strings{"yuzu alias"}) })
	akabeiID := seed("Akabeisoft2", 3*time.Hour, nil)
	db.Ent.GameDeveloperRelation.Create().SetGameID(db.Game(t)).SetDeveloperID(yuzuID).ExecX(ctx)
	db.Ent.GameDeveloperRelation.Create().SetGameID(db.Game(t, func(c *ent.GameCreate) { c.SetStatus(2) })).SetDeveloperID(yuzuID).ExecX(ctx)

	entries, total, err := repo.Search(ctx, developer.AdminFilter{Search: "YUZU", SortBy: developer.SortByID}, developer.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(entries) != 1 {
		t.Fatalf("name only, case-insensitive: %+v %d %v", entries, total, err)
	}
	got := entries[0]
	if got.ID != yuzuID || got.Name != "Yuzusoft" || got.Logo == nil || *got.Logo != "logo.webp" || got.GamesCount != 2 ||
		!got.Created.Equal(base.Add(time.Hour)) || !got.Updated.Equal(base.Add(-time.Hour)) {
		t.Fatalf("entry %+v", got)
	}

	order := func(filter developer.AdminFilter) []int {
		t.Helper()
		entries, _, err := repo.Search(ctx, filter, developer.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		ids := make([]int, len(entries))
		for i, entry := range entries {
			ids[i] = entry.ID
		}
		return ids
	}
	if ids := order(developer.AdminFilter{SortBy: developer.SortByID, Descending: true}); !slices.Equal(ids, []int{akabeiID, keyID, yuzuID}) {
		t.Fatalf("id desc: %v", ids)
	}
	if ids := order(developer.AdminFilter{SortBy: developer.SortByName}); !slices.Equal(ids, []int{akabeiID, keyID, yuzuID}) {
		t.Fatalf("name asc: %v", ids)
	}
	if ids := order(developer.AdminFilter{SortBy: developer.SortByUpdated, Descending: true}); !slices.Equal(ids, []int{yuzuID, keyID, akabeiID}) {
		t.Fatalf("updated desc: %v", ids)
	}
	entries, total, err = repo.Search(ctx, developer.AdminFilter{SortBy: developer.SortByCreated}, developer.Page{Number: 2, Size: 2})
	if err != nil || total != 3 || len(entries) != 1 || entries[0].ID != akabeiID || entries[0].Logo != nil || entries[0].GamesCount != 0 {
		t.Fatalf("second page: %+v %d %v", entries, total, err)
	}
}
