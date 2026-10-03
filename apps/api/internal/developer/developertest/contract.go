package developertest

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
)

type Env struct {
	Repo developer.Repository
	Seed func(t *testing.T, d developer.Developer) int
	Link func(t *testing.T, developerID int, hidden bool)
}

func ptr[T any](v T) *T {
	return &v
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()

	t.Run("get returns the detail with ordered extra info", func(t *testing.T) {
		env := newEnv(t)
		id := env.Seed(t, developer.Developer{
			Name: "ゆずソフト", Aliases: []string{"Yuzusoft"}, Logo: ptr("logos/yuzu.webp"), IntroJP: "jp", IntroZH: "zh",
			Website: ptr("https://yuzu-soft.com"), HID: ptr(5),
			ExtraInfo: []developer.ExtraInfo{{Key: "官网", Value: "https://yuzu-soft.com"}, {Key: "国家/地区", Value: "日本"}},
		})
		got, err := env.Repo.Get(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		if got.ID != id || got.Name != "ゆずソフト" || len(got.Aliases) != 1 || *got.Logo != "logos/yuzu.webp" || got.IntroEN != "" || *got.Website != "https://yuzu-soft.com" {
			t.Fatalf("unexpected developer %+v", got)
		}
		if got.HID == nil || *got.HID != 5 || len(got.ExtraInfo) != 2 || got.ExtraInfo[1] != (developer.ExtraInfo{Key: "国家/地区", Value: "日本"}) {
			t.Fatalf("unexpected extra info %+v", got)
		}
		empty, err := env.Repo.Get(ctx, env.Seed(t, developer.Developer{Name: "bare"}))
		if err != nil || empty.ExtraInfo == nil || len(empty.ExtraInfo) != 0 || empty.Aliases == nil {
			t.Fatalf("empty collections must not be nil: %+v %v", empty, err)
		}
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, developer.ErrNotFound) {
			t.Fatalf("missing developer: %v", err)
		}
		if _, err := env.Repo.Lock(ctx, 987654); !errors.Is(err, developer.ErrNotFound) {
			t.Fatalf("lock missing developer: %v", err)
		}
	})

	t.Run("list searches names and aliases, orders by name and counts visible works", func(t *testing.T) {
		env := newEnv(t)
		yuzu := env.Seed(t, developer.Developer{Name: "Yuzusoft", Aliases: []string{"柚子社"}})
		key := env.Seed(t, developer.Developer{Name: "Key"})
		env.Link(t, yuzu, false)
		env.Link(t, yuzu, false)
		env.Link(t, yuzu, true)

		all, total, err := env.Repo.List(ctx, "", developer.Page{Number: 1, Size: 10})
		if err != nil || total != 2 || all[0].ID != key || all[1].ID != yuzu {
			t.Fatalf("unfiltered list: %+v %d %v", all, total, err)
		}
		if all[1].WorksCount != 2 || all[0].WorksCount != 0 {
			t.Fatalf("works count must only include visible games: %+v", all)
		}
		byAlias, total, err := env.Repo.List(ctx, "柚子", developer.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || byAlias[0].ID != yuzu || byAlias[0].Aliases[0] != "柚子社" {
			t.Fatalf("alias search: %+v %d %v", byAlias, total, err)
		}
		byName, _, err := env.Repo.List(ctx, "KE", developer.Page{Number: 1, Size: 10})
		if err != nil || len(byName) != 1 || byName[0].ID != key {
			t.Fatalf("name search: %+v %v", byName, err)
		}
		second, total, err := env.Repo.List(ctx, "", developer.Page{Number: 2, Size: 1})
		if err != nil || total != 2 || len(second) != 1 || second[0].ID != yuzu {
			t.Fatalf("second page: %+v %d %v", second, total, err)
		}
	})

	t.Run("relations and children are reported and relations block deletion", func(t *testing.T) {
		env := newEnv(t)
		parent := env.Seed(t, developer.Developer{Name: "parent"})
		env.Seed(t, developer.Developer{Name: "child", ParentID: &parent})
		linked := env.Seed(t, developer.Developer{Name: "linked"})
		env.Link(t, linked, false)

		if has, err := env.Repo.HasChildren(ctx, parent); err != nil || !has {
			t.Fatalf("children: %v %v", has, err)
		}
		if has, err := env.Repo.HasChildren(ctx, linked); err != nil || has {
			t.Fatalf("no children: %v %v", has, err)
		}
		if has, err := env.Repo.HasRelations(ctx, linked); err != nil || !has {
			t.Fatalf("relations: %v %v", has, err)
		}
		if err := env.Repo.Delete(ctx, linked); !errors.Is(err, developer.ErrHasRelations) {
			t.Fatalf("delete linked: %v", err)
		}
		if err := env.Repo.Delete(ctx, parent); err != nil {
			t.Fatal(err)
		}
		if err := env.Repo.Delete(ctx, parent); !errors.Is(err, developer.ErrNotFound) {
			t.Fatalf("delete twice: %v", err)
		}
	})
}
