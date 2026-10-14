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

func TestAPageGetsTheRunningAdsMeantForItsViewer(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	f.create(t, adtest.Banner("open", ad.SlotHome, ad.SlotDownload))
	adult := adtest.Banner("adult", ad.SlotHome)
	adult.BannerAdult = true
	f.create(t, adult)
	japanese := adtest.Banner("japanese", ad.SlotHome)
	japanese.Languages = []string{"ja"}
	f.create(t, japanese)
	later := adtest.Banner("later", ad.SlotHome)
	later.StartAt = ptr(now.Add(time.Hour))
	f.create(t, later)
	f.create(t, adtest.Side("side"))

	guest := actor.Actor{ContentLimit: actor.ContentLimitGuest}
	placed, err := f.placements.Place(ctx, guest, "zh", []ad.Slot{ad.SlotHome, ad.SlotSidebar, ad.SlotHome, "nowhere"})
	if err != nil || len(placed) != 2 || placed[0].Slot != ad.SlotHome || placed[1].Slot != ad.SlotSidebar {
		t.Fatalf("placed %+v %v", placed, err)
	}
	if !slices.Equal(names(placed[0].Ads), []string{"open"}) || placed[0].Ads[0].Image != "spotlight/banner/open.webp" || placed[0].Ads[0].Icon != nil {
		t.Fatalf("guest home %+v", placed[0].Ads)
	}
	if side := placed[1].Ads; len(side) != 1 || side[0].Image != "spotlight/side/side.webp" || *side[0].Icon != "spotlight/icon/side.webp" {
		t.Fatalf("guest sidebar %+v", side)
	}
	open := actor.Actor{UserID: 3, ContentLimit: actor.ContentLimitJustShow}
	placed, err = f.placements.Place(ctx, open, "zh", []ad.Slot{ad.SlotHome})
	if err != nil || len(placed[0].Ads) != 2 {
		t.Fatalf("a viewer who sees adult content gets both banners: %+v %v", placed, err)
	}
	placed, _ = f.placements.Place(ctx, guest, "ja", []ad.Slot{ad.SlotHome})
	if !slices.Equal(names(placed[0].Ads), []string{"japanese"}) {
		t.Fatalf("japanese page %+v", placed[0].Ads)
	}
}

func TestSponsorsAndASwitchedOffSiteSeeNoAds(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	f.create(t, adtest.Banner("open", ad.SlotHome))
	f.repo.SetSponsor(7, now.Add(time.Hour))
	placed, err := f.placements.Place(ctx, actor.Actor{UserID: 7, Role: actor.RoleUser}, "zh", []ad.Slot{ad.SlotHome})
	if err != nil || len(placed) != 1 || len(placed[0].Ads) != 0 {
		t.Fatalf("sponsor %+v %v", placed, err)
	}
	settingtest.Set(f.settings, ad.Enabled, false)
	placed, err = f.placements.Place(ctx, actor.Actor{}, "zh", []ad.Slot{ad.SlotHome})
	if err != nil || len(placed[0].Ads) != 0 {
		t.Fatalf("ads off %+v %v", placed, err)
	}
}

func TestOnlyViewsOfAdsRunningInTheirSlotAreCounted(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	home := f.create(t, adtest.Banner("home", ad.SlotHome))
	views := []ad.View{{AdID: home.ID, Slot: ad.SlotHome}, {AdID: home.ID, Slot: ad.SlotHome}, {AdID: home.ID, Slot: ad.SlotGame}, {AdID: 99, Slot: ad.SlotHome}, {AdID: home.ID, Slot: "nowhere"}}
	for range ad.MaxViewsPerReport {
		views = append(views, ad.View{AdID: home.ID, Slot: ad.SlotHome})
	}
	if err := f.placements.RecordViews(ctx, views); err != nil {
		t.Fatal(err)
	}
	today := ad.DayOf(now, 8*time.Hour)
	rows, err := f.repo.Counts(ctx, nil, today, today)
	if err != nil || len(rows) != 1 || rows[0].Views != ad.MaxViewsPerReport-3 {
		t.Fatalf("counted %+v %v", rows, err)
	}
}

func TestAClickLeadsToTheLinkAndCountsOncePerVisitorAWhile(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()
	home := f.create(t, adtest.Banner("home", ad.SlotHome))
	visitor := ad.Visitor{IP: "203.0.113.9", UserAgent: "browser"}
	for range 2 {
		link, err := f.placements.Click(ctx, home.ID, ad.SlotHome, visitor)
		if err != nil || link != "https://example.test/home" {
			t.Fatalf("click: %s %v", link, err)
		}
	}
	if _, err := f.placements.Click(ctx, home.ID, ad.SlotHome, ad.Visitor{IP: "203.0.113.10", UserAgent: "browser"}); err != nil {
		t.Fatal(err)
	}
	if link, err := f.placements.Click(ctx, home.ID, ad.SlotGame, visitor); err != nil || link != "https://example.test/home" {
		t.Fatalf("a slot the ad does not run in still leads to it: %s %v", link, err)
	}
	if _, err := f.placements.Click(ctx, 999, ad.SlotHome, visitor); !errors.Is(err, ad.ErrNotFound) {
		t.Fatalf("missing ad: %v", err)
	}
	today := ad.DayOf(now, 8*time.Hour)
	rows, _ := f.repo.Counts(ctx, nil, today, today)
	if len(rows) != 1 || rows[0].Clicks != 2 || rows[0].Slot != ad.SlotHome {
		t.Fatalf("two visitors, one click each: %+v", rows)
	}
}
