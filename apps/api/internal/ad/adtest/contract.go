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

func Banner(name string, slots ...ad.Slot) ad.Draft {
	return ad.Draft{
		Name:      name,
		Link:      "https://example.test/" + name,
		Banner:    ptr("spotlight/banner/" + name + ".webp"),
		Slots:     slots,
		Languages: []string{"zh"},
		Weight:    ad.DefaultWeight,
		Enabled:   true,
	}
}

func Side(name string) ad.Draft {
	return ad.Draft{
		Name:      name,
		Link:      "https://example.test/" + name,
		SideImage: ptr("spotlight/side/" + name + ".webp"),
		SideIcon:  ptr("spotlight/icon/" + name + ".webp"),
		Slots:     []ad.Slot{ad.SlotSidebar},
		Languages: []string{"zh"},
		Weight:    ad.DefaultWeight,
		Enabled:   true,
	}
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	at := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)

	t.Run("an ad is created, read, replaced and deleted with every field", func(t *testing.T) {
		env := newEnv(t)
		full := Banner("full", ad.SlotHome, ad.SlotSidebar)
		full.BannerAdult = true
		full.SideImage, full.SideIcon, full.SideAdult = ptr("spotlight/side/full.webp"), ptr("spotlight/icon/full.webp"), true
		full.Languages, full.Weight = []string{"zh", "ja"}, 9
		full.StartAt, full.EndAt = ptr(at.Add(-time.Hour)), ptr(at.Add(time.Hour))
		created, err := env.Repo.Create(ctx, full)
		if err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.Get(ctx, created.ID)
		if err != nil || got.Name != "full" || got.Link != "https://example.test/full" || *got.Banner != "spotlight/banner/full.webp" || !got.BannerAdult ||
			*got.SideImage != "spotlight/side/full.webp" || *got.SideIcon != "spotlight/icon/full.webp" || !got.SideAdult || !slices.Equal(got.Slots, []ad.Slot{ad.SlotHome, ad.SlotSidebar}) ||
			!slices.Equal(got.Languages, []string{"zh", "ja"}) || got.Weight != 9 || !got.Enabled || !got.StartAt.Equal(at.Add(-time.Hour)) || !got.EndAt.Equal(at.Add(time.Hour)) || got.Created.IsZero() {
			t.Fatalf("created ad %+v %v", got, err)
		}
		replaced, err := env.Repo.Replace(ctx, created.ID, Banner("plain", ad.SlotGame))
		if err != nil || replaced.Name != "plain" || replaced.SideImage != nil || replaced.SideIcon != nil || replaced.BannerAdult || replaced.StartAt != nil || replaced.EndAt != nil || !slices.Equal(replaced.Slots, []ad.Slot{ad.SlotGame}) {
			t.Fatalf("replaced ad %+v %v", replaced, err)
		}
		if _, err := env.Repo.Replace(ctx, 987654, Banner("none")); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("replace missing: %v", err)
		}
		if err := env.Repo.Delete(ctx, created.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := env.Repo.Get(ctx, created.ID); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("deleted ad: %v", err)
		}
		if err := env.Repo.Delete(ctx, created.ID); !errors.Is(err, ad.ErrNotFound) {
			t.Fatalf("delete missing: %v", err)
		}
	})

	t.Run("ads are found by slot, status and running time", func(t *testing.T) {
		env := newEnv(t)
		mustCreate := func(draft ad.Draft) ad.Ad {
			t.Helper()
			created, err := env.Repo.Create(ctx, draft)
			if err != nil {
				t.Fatal(err)
			}
			return created
		}
		running := mustCreate(Banner("running", ad.SlotHome, ad.SlotGame))
		scheduled := Banner("scheduled", ad.SlotHome)
		scheduled.StartAt = ptr(at.Add(time.Hour))
		later := mustCreate(scheduled)
		ended := Banner("ended", ad.SlotHome)
		ended.EndAt = ptr(at)
		over := mustCreate(ended)
		disabled := Banner("disabled", ad.SlotHome)
		disabled.Enabled = false
		off := mustCreate(disabled)
		side := mustCreate(Side("side"))

		enabled, err := env.Repo.Enabled(ctx, ad.SlotHome)
		if err != nil || !slices.Equal(ids(enabled), []int{running.ID, later.ID, over.ID}) {
			t.Fatalf("enabled in home: %v %v", ids(enabled), err)
		}
		live, err := env.Repo.Running(ctx, at)
		if err != nil || !slices.Equal(ids(live), []int{running.ID, side.ID}) {
			t.Fatalf("running: %v %v", ids(live), err)
		}
		for status, want := range map[ad.Status][]int{
			ad.StatusRunning:   {side.ID, running.ID},
			ad.StatusScheduled: {later.ID},
			ad.StatusEnded:     {over.ID},
			ad.StatusDisabled:  {off.ID},
		} {
			listed, total, err := env.Repo.List(ctx, ad.ListFilter{Status: &status}, at, ad.Page{Number: 1, Size: 10})
			if err != nil || total != len(want) || !slices.Equal(ids(listed), want) {
				t.Fatalf("%s: %v %d %v", status, ids(listed), total, err)
			}
		}
		slot := ad.SlotGame
		listed, total, err := env.Repo.List(ctx, ad.ListFilter{Slot: &slot}, at, ad.Page{Number: 1, Size: 10})
		if err != nil || total != 1 || !slices.Equal(ids(listed), []int{running.ID}) {
			t.Fatalf("in game: %v %d %v", ids(listed), total, err)
		}
		page, total, err := env.Repo.List(ctx, ad.ListFilter{}, at, ad.Page{Number: 2, Size: 2})
		if err != nil || total != 5 || !slices.Equal(ids(page), []int{over.ID, later.ID}) {
			t.Fatalf("second page, newest first: %v %d %v", ids(page), total, err)
		}
	})

	t.Run("views and clicks add up per ad, slot and day and go with the ad", func(t *testing.T) {
		env := newEnv(t)
		first, err := env.Repo.Create(ctx, Banner("first", ad.SlotHome, ad.SlotGame))
		if err != nil {
			t.Fatal(err)
		}
		second, err := env.Repo.Create(ctx, Banner("second", ad.SlotHome))
		if err != nil {
			t.Fatal(err)
		}
		day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
		next := day.AddDate(0, 0, 1)
		home, game := ad.View{AdID: first.ID, Slot: ad.SlotHome}, ad.View{AdID: first.ID, Slot: ad.SlotGame}
		other := ad.View{AdID: second.ID, Slot: ad.SlotHome}
		steps := []error{
			env.Repo.AddViews(ctx, day, map[ad.View]int{home: 2, game: 1}),
			env.Repo.AddViews(ctx, day, map[ad.View]int{home: 3}),
			env.Repo.AddClick(ctx, day, home),
			env.Repo.AddClick(ctx, next, home),
			env.Repo.AddViews(ctx, next, map[ad.View]int{other: 4}),
		}
		if err := errors.Join(steps...); err != nil {
			t.Fatal(err)
		}
		rows, err := env.Repo.Counts(ctx, []int{first.ID}, day, day)
		if err != nil {
			t.Fatal(err)
		}
		totals := ad.TotalsBySlot(rows)
		if len(rows) != 2 || totals[ad.SlotHome] != (ad.Counts{Views: 5, Clicks: 1}) || totals[ad.SlotGame] != (ad.Counts{Views: 1}) || !rows[0].Day.Equal(day) {
			t.Fatalf("first day of the first ad: %+v", rows)
		}
		all, err := env.Repo.Counts(ctx, nil, day, next)
		if err != nil || ad.TotalsByAd(all)[first.ID] != (ad.Counts{Views: 6, Clicks: 2}) || ad.TotalsByAd(all)[second.ID] != (ad.Counts{Views: 4}) {
			t.Fatalf("every ad over both days: %+v %v", all, err)
		}
		if none, err := env.Repo.Counts(ctx, []int{}, day, next); err != nil || len(none) != 0 {
			t.Fatalf("no ads asked: %+v %v", none, err)
		}
		if err := env.Repo.Delete(ctx, first.ID); err != nil {
			t.Fatal(err)
		}
		if left, err := env.Repo.Counts(ctx, nil, day, next); err != nil || len(left) != 1 || left[0].AdID != second.ID {
			t.Fatalf("counts go with their ad: %+v %v", left, err)
		}
	})

	t.Run("sponsors are recognised while their badge lasts", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		if sponsor, err := env.Sponsors.IsSponsor(ctx, user, at); err != nil || sponsor {
			t.Fatalf("not a sponsor yet: %v %v", sponsor, err)
		}
		env.SetSponsor(t, user, at.Add(time.Hour))
		if sponsor, err := env.Sponsors.IsSponsor(ctx, user, at); err != nil || !sponsor {
			t.Fatalf("sponsor: %v %v", sponsor, err)
		}
		if sponsor, err := env.Sponsors.IsSponsor(ctx, user, at.Add(2*time.Hour)); err != nil || sponsor {
			t.Fatalf("expired sponsor: %v %v", sponsor, err)
		}
	})
}

func ids(ads []ad.Ad) []int {
	out := make([]int, len(ads))
	for i, item := range ads {
		out[i] = item.ID
	}
	return out
}
