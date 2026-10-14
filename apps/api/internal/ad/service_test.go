package ad_test

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestSavingAnAdChecksItTidiesItAndDropsTheCachedSlots(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	if _, err := f.service.Create(ctx, adtest.Banner("wrong", ad.SlotSidebar)); !errors.Is(err, ad.ErrSlotNeedsMaterial) {
		t.Fatalf("a slot without its material: %v", err)
	}
	draft := adtest.Banner("tidy", ad.SlotDownload, ad.SlotHome, ad.SlotHome)
	draft.Languages = []string{"ja", "zh", "ja"}
	created := f.create(t, draft)
	if !slices.Equal(created.Slots, []ad.Slot{ad.SlotHome, ad.SlotDownload}) || !slices.Equal(created.Languages, []string{"zh", "ja"}) {
		t.Fatalf("slots and languages in their order: %v %v", created.Slots, created.Languages)
	}
	if _, err := f.placements.Place(ctx, actor.Actor{}, "zh", []ad.Slot{ad.SlotHome}); err != nil {
		t.Fatal(err)
	}
	if !f.cache.Has(ad.SlotCachePrefix + "home") {
		t.Fatal("the slot is cached after a page asks for it")
	}
	if _, err := f.service.Replace(ctx, created.ID, adtest.Banner("tidy", ad.SlotGame)); err != nil {
		t.Fatal(err)
	}
	if f.cache.Has(ad.SlotCachePrefix + "home") {
		t.Fatal("a saved ad drops the cached slots")
	}
	if err := f.service.Delete(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Get(ctx, created.ID); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("deleted: %v", err)
	}
}

func TestTheListCarriesTheCountsOfTheLastSevenDays(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	first := f.create(t, adtest.Banner("first", ad.SlotHome))
	second := f.create(t, adtest.Banner("second", ad.SlotHome))
	today := ad.DayOf(now, 8*time.Hour)
	views := func(day time.Time, id, count int) {
		if err := f.repo.AddViews(ctx, day, map[ad.View]int{{AdID: id, Slot: ad.SlotHome}: count}); err != nil {
			t.Fatal(err)
		}
	}
	views(today, first.ID, 5)
	views(today.AddDate(0, 0, -6), first.ID, 2)
	views(today.AddDate(0, 0, -7), first.ID, 100)
	listed, total, err := f.service.List(ctx, ad.ListFilter{}, ad.Page{Number: 1, Size: 10})
	if err != nil || total != 2 || listed[0].Ad.ID != second.ID || listed[1].Week.Views != 7 || listed[0].Week != (ad.Counts{}) {
		t.Fatalf("listed %+v %d %v", listed, total, err)
	}
}

func TestTheReportOverviewAndSlotsSumTheCounts(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	banner := f.create(t, adtest.Banner("banner", ad.SlotHome, ad.SlotDownload))
	side := f.create(t, adtest.Side("side"))
	paused := adtest.Banner("paused", ad.SlotHome)
	paused.Enabled = false
	f.create(t, paused)
	today := ad.DayOf(now, 8*time.Hour)
	if err := f.repo.AddViews(ctx, today, map[ad.View]int{{AdID: banner.ID, Slot: ad.SlotHome}: 10, {AdID: banner.ID, Slot: ad.SlotDownload}: 4, {AdID: side.ID, Slot: ad.SlotSidebar}: 3}); err != nil {
		t.Fatal(err)
	}
	if err := f.repo.AddClick(ctx, today.AddDate(0, 0, -20), ad.View{AdID: banner.ID, Slot: ad.SlotHome}); err != nil {
		t.Fatal(err)
	}
	report, err := f.service.Report(ctx, banner.ID, ad.MonthDays)
	if err != nil || len(report.Days) != 30 || report.Total != (ad.Counts{Views: 14, Clicks: 1}) || report.Days[29].Views != 14 || report.Days[9].Clicks != 1 || len(report.Slots) != 2 {
		t.Fatalf("report %+v %v", report, err)
	}
	if _, err := f.service.Report(ctx, 999, ad.WeekDays); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("report of a missing ad: %v", err)
	}
	settingtest.Set(f.settings, ad.Enabled, false)
	overview, err := f.service.Overview(ctx)
	if err != nil || overview.Running != 2 || overview.Week != (ad.Counts{Views: 17}) || overview.Enabled {
		t.Fatalf("overview %+v %v", overview, err)
	}
	slots, err := f.service.Slots(ctx)
	if err != nil || len(slots) != 5 {
		t.Fatalf("slots %+v %v", slots, err)
	}
	if home := slots[0]; home.Spec.Slot != ad.SlotHome || len(home.Running) != 1 || home.Running[0].Name != "banner" || home.Week.Views != 10 {
		t.Fatalf("home %+v", home)
	}
	if sidebar := slots[4]; sidebar.Spec.Material != ad.MaterialSide || sidebar.Spec.Shown != 3 || len(sidebar.Running) != 1 || sidebar.Week.Views != 3 {
		t.Fatalf("sidebar %+v", sidebar)
	}
}
