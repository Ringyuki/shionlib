package ad_test

import (
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
)

func TestBannersArePickedByWeightWithoutRepeats(t *testing.T) {
	pool := []ad.Ad{{ID: 1, Weight: 1}, {ID: 2, Weight: 3}, {ID: 3, Weight: 6}}
	home, _ := ad.SlotHome.Spec()
	draws := []float64{0.95, 0.05}
	picked := ad.Pick(pool, home, func() float64 { next := draws[0]; draws = draws[1:]; return next })
	if len(picked) != 2 || picked[0].ID != 3 || picked[1].ID != 1 {
		t.Fatalf("picked %+v", picked)
	}
	download, _ := ad.SlotDownload.Spec()
	if one := ad.Pick(pool, download, func() float64 { return 0.2 }); len(one) != 1 || one[0].ID != 2 {
		t.Fatalf("one banner in the download slot: %+v", one)
	}
	if none := ad.Pick(nil, home, func() float64 { return 0 }); len(none) != 0 {
		t.Fatalf("nothing to pick: %+v", none)
	}
}

func TestSidebarAdsGoByWeightThenNewest(t *testing.T) {
	sidebar, _ := ad.SlotSidebar.Spec()
	pool := []ad.Ad{
		{ID: 1, Weight: 5, Created: now},
		{ID: 2, Weight: 9, Created: now},
		{ID: 3, Weight: 5, Created: now.Add(time.Hour)},
		{ID: 4, Weight: 1, Created: now},
	}
	picked := ad.Pick(pool, sidebar, func() float64 { return 0 })
	got := []int{}
	for _, item := range picked {
		got = append(got, item.ID)
	}
	if !slices.Equal(got, []int{2, 3, 1}) {
		t.Fatalf("sidebar order %v", got)
	}
}

func TestDaysFollowTheSiteClock(t *testing.T) {
	late := time.Date(2026, 10, 14, 17, 0, 0, 0, time.UTC)
	if day := ad.DayOf(late, 8*time.Hour); !day.Equal(time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("day %v", day)
	}
}

func TestAReportFillsEveryDayAndListsSlotsInTheirOrder(t *testing.T) {
	from := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	report := ad.Summarize([]ad.DailyCount{
		{AdID: 1, Slot: ad.SlotDownload, Day: from, Counts: ad.Counts{Views: 4, Clicks: 1}},
		{AdID: 1, Slot: ad.SlotHome, Day: from.AddDate(0, 0, 2), Counts: ad.Counts{Views: 6}},
		{AdID: 1, Slot: ad.SlotHome, Day: from.AddDate(0, 0, 9), Counts: ad.Counts{Views: 100}},
	}, from, 7)
	if len(report.Days) != 7 || report.Days[0].Views != 4 || report.Days[1].Views != 0 || report.Days[2].Views != 6 || !report.Days[6].Day.Equal(from.AddDate(0, 0, 6)) {
		t.Fatalf("days %+v", report.Days)
	}
	if report.Total != (ad.Counts{Views: 110, Clicks: 1}) || len(report.Slots) != 2 || report.Slots[0].Slot != ad.SlotHome || report.Slots[1].Slot != ad.SlotDownload {
		t.Fatalf("report %+v", report)
	}
}
