package ad_test

import (
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
)

func TestADraftNeedsAMaterialThatFitsEachSlot(t *testing.T) {
	both := adtest.Banner("both", ad.SlotHome, ad.SlotSidebar)
	both.SideImage, both.SideIcon = ptr("spotlight/side/both.webp"), ptr("spotlight/icon/both.webp")
	noMaterial := adtest.Banner("none")
	noMaterial.Banner = nil
	halfSide := adtest.Side("half")
	halfSide.SideIcon = nil
	reversed := adtest.Banner("reversed", ad.SlotHome)
	reversed.StartAt, reversed.EndAt = ptr(now), ptr(now.Add(-time.Hour))
	badLanguage := adtest.Banner("language", ad.SlotHome)
	badLanguage.Languages = []string{"fr"}
	heavy := adtest.Banner("heavy", ad.SlotHome)
	heavy.Weight = 11
	cases := []struct {
		draft ad.Draft
		want  error
	}{
		{adtest.Banner("banner", ad.SlotHome, ad.SlotDownload), nil},
		{adtest.Side("side"), nil},
		{both, nil},
		{noMaterial, ad.ErrNoMaterial},
		{halfSide, ad.ErrSideIncomplete},
		{adtest.Banner("banner", ad.SlotSidebar), ad.ErrSlotNeedsMaterial},
		{adtest.Banner("banner", "nowhere"), ad.ErrInvalidDraft},
		{badLanguage, ad.ErrInvalidDraft},
		{heavy, ad.ErrInvalidDraft},
		{reversed, ad.ErrScheduleReversed},
	}
	for _, c := range cases {
		if err := c.draft.Check(); !errors.Is(err, c.want) {
			t.Fatalf("%s: %v want %v", c.draft.Name, err, c.want)
		}
	}
}

func TestTheStatusFollowsTheSwitchAndTheSchedule(t *testing.T) {
	item := ad.Ad{Enabled: true}
	if item.Status(now) != ad.StatusRunning {
		t.Fatal("no schedule runs")
	}
	item.StartAt = ptr(now.Add(time.Minute))
	if item.Status(now) != ad.StatusScheduled {
		t.Fatal("a future start waits")
	}
	item.StartAt, item.EndAt = nil, ptr(now)
	if item.Status(now) != ad.StatusEnded {
		t.Fatal("the end time ends it")
	}
	item.Enabled = false
	if item.Status(now) != ad.StatusDisabled {
		t.Fatal("the switch wins")
	}
}

func TestAdultImagesAreShownOnlyToViewersWhoSeeAdultContentOpenly(t *testing.T) {
	item := ad.Ad{Banner: ptr("b"), BannerAdult: true, SideImage: ptr("s"), SideIcon: ptr("i"), Languages: []string{"zh"}}
	for limit, want := range map[actor.ContentLimit]bool{
		actor.ContentLimitGuest:       false,
		actor.ContentLimitNeverShow:   false,
		actor.ContentLimitShowSpoiler: false,
		actor.ContentLimitJustShow:    true,
	} {
		viewer := actor.Actor{ContentLimit: limit}
		if item.ShownTo(viewer, "zh", ad.MaterialBanner) != want {
			t.Fatalf("adult banner for %v", limit)
		}
		if !item.ShownTo(viewer, "zh", ad.MaterialSide) {
			t.Fatalf("an all-ages sidebar image is shown to %v", limit)
		}
	}
	if item.ShownTo(actor.Actor{ContentLimit: actor.ContentLimitJustShow}, "en", ad.MaterialSide) {
		t.Fatal("a language the ad does not run in")
	}
}
