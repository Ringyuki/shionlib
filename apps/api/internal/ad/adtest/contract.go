package adtest

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
)

type Env struct {
	Repo       ad.Repository
	Sponsors   ad.Sponsors
	NewUser    func(t *testing.T) int
	SetSponsor func(t *testing.T, userID int, until time.Time)
}

func ptr[T any](v T) *T {
	return &v
}

func draft(name string, placement ...string) ad.NewAd {
	return ad.NewAd{
		Name:           name,
		Placement:      placement,
		ImageZH:        name + "-zh.webp",
		Aspect:         "16:9",
		Link:           "https://example.test/" + name,
		ExcludeLocales: []string{},
		Enabled:        true,
	}
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	at := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	t.Run("create and get round trip every column", func(t *testing.T) {
		env := newEnv(t)
		in := draft("full", "home-after-hot", "game-detail-bottom")
		in.ImageJA = ptr("ja.webp")
		in.ExcludeLocales = []string{"en"}
		in.Sort = 3
		in.StartAt = ptr(at)
		created, err := env.Repo.Create(ctx, in)
		if err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != "full" || !slices.Equal(got.Placement, in.Placement) || got.ImageJA == nil || *got.ImageJA != "ja.webp" || got.ImageEN != nil ||
			!slices.Equal(got.ExcludeLocales, []string{"en"}) || got.Sort != 3 || got.StartAt == nil || !got.StartAt.Equal(at) || got.EndAt != nil || !got.Enabled || got.Created.IsZero() {
			t.Fatalf("unexpected ad %+v", got)
		}
	})

	t.Run("missing ads are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(ctx, 987654); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
		if _, err := env.Repo.Update(ctx, 987654, ad.Changes{Name: ptr("x")}); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("update: %v", err)
		}
		if err := env.Repo.Delete(ctx, 987654); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("delete: %v", err)
		}
	})

	t.Run("active ads honour placement, enabled flag and time window ordered by sort", func(t *testing.T) {
		env := newEnv(t)
		later := draft("later", "home")
		later.Sort = 2
		first := draft("first", "home", "other")
		first.Sort = 1
		disabled := draft("disabled", "home")
		disabled.Enabled = false
		future := draft("future", "home")
		future.StartAt = ptr(at.Add(time.Hour))
		ended := draft("ended", "home")
		ended.EndAt = ptr(at.Add(-time.Hour))
		window := draft("window", "home")
		window.Sort = 5
		window.StartAt = ptr(at.Add(-time.Hour))
		window.EndAt = ptr(at.Add(time.Hour))
		elsewhere := draft("elsewhere", "sidebar")
		for _, in := range []ad.NewAd{later, first, disabled, future, ended, window, elsewhere} {
			if _, err := env.Repo.Create(ctx, in); err != nil {
				t.Fatal(err)
			}
		}
		active, err := env.Repo.Active(ctx, "home", at)
		if err != nil {
			t.Fatal(err)
		}
		var names []string
		for _, item := range active {
			names = append(names, item.Name)
		}
		if !slices.Equal(names, []string{"first", "later", "window"}) {
			t.Fatalf("unexpected active ads %v", names)
		}
		none, err := env.Repo.Active(ctx, "nowhere", at)
		if err != nil || none == nil || len(none) != 0 {
			t.Fatalf("unknown placements give an empty list: %v %v", none, err)
		}
	})

	t.Run("list filters, sorts and paginates", func(t *testing.T) {
		env := newEnv(t)
		a, _ := env.Repo.Create(ctx, draft("a", "home"))
		disabled := draft("b", "home")
		disabled.Enabled = false
		b, _ := env.Repo.Create(ctx, disabled)
		c, _ := env.Repo.Create(ctx, draft("c", "sidebar"))
		all, total, err := env.Repo.List(ctx, ad.ListFilter{SortBy: ad.SortByID, Descending: true}, ad.Page{Number: 1, Size: 2})
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || len(all) != 2 || all[0].ID != c.ID || all[1].ID != b.ID {
			t.Fatalf("unexpected listing %d %+v", total, all)
		}
		home := "home"
		enabled := true
		filtered, total, _ := env.Repo.List(ctx, ad.ListFilter{Placement: &home, Enabled: &enabled, SortBy: ad.SortByID}, ad.Page{Number: 1, Size: 10})
		if total != 1 || len(filtered) != 1 || filtered[0].ID != a.ID {
			t.Fatalf("unexpected filtered listing %d %+v", total, filtered)
		}
	})

	t.Run("update applies provided fields and clears nullable ones", func(t *testing.T) {
		env := newEnv(t)
		in := draft("before", "home")
		in.ImageJA = ptr("ja.webp")
		in.StartAt = ptr(at)
		created, _ := env.Repo.Create(ctx, in)
		updated, err := env.Repo.Update(ctx, created.ID, ad.Changes{
			Name:      ptr("after"),
			Placement: ptr([]string{"sidebar"}),
			ImageJA:   ad.Clearable[string]{Set: true},
			ImageEN:   ad.Clearable[string]{Set: true, Value: ptr("en.webp")},
			Enabled:   ptr(false),
			Sort:      ptr(9),
			StartAt:   ad.Clearable[time.Time]{Set: true},
			EndAt:     ad.Clearable[time.Time]{Set: true, Value: ptr(at.Add(time.Hour))},
		})
		if err != nil {
			t.Fatal(err)
		}
		if updated.Name != "after" || !slices.Equal(updated.Placement, []string{"sidebar"}) || updated.ImageJA != nil || updated.ImageEN == nil || *updated.ImageEN != "en.webp" ||
			updated.Enabled || updated.Sort != 9 || updated.StartAt != nil || updated.EndAt == nil || updated.ImageZH != "before-zh.webp" || updated.Link != in.Link {
			t.Fatalf("unexpected updated ad %+v", updated)
		}
		untouched, _ := env.Repo.Update(ctx, created.ID, ad.Changes{Aspect: ptr("1:1")})
		if untouched.ImageEN == nil || untouched.EndAt == nil || untouched.Aspect != "1:1" {
			t.Fatalf("absent fields must stay unchanged %+v", untouched)
		}
	})

	t.Run("delete removes the ad", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.Create(ctx, draft("gone", "home"))
		if err := env.Repo.Delete(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, created.ID); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("deleted ad still readable: %v", err)
		}
	})

	t.Run("sponsors are users whose badge has not expired", func(t *testing.T) {
		env := newEnv(t)
		active, expired, plain := env.NewUser(t), env.NewUser(t), env.NewUser(t)
		env.SetSponsor(t, active, at.Add(time.Hour))
		env.SetSponsor(t, expired, at.Add(-time.Hour))
		for userID, want := range map[int]bool{active: true, expired: false, plain: false, 987654: false} {
			got, err := env.Sponsors.IsSponsor(ctx, userID, at)
			if err != nil || got != want {
				t.Fatalf("user %d: got %v want %v (%v)", userID, got, want, err)
			}
		}
	})
}
