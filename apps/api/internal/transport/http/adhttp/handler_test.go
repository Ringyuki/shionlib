package adhttp_test

import (
	"context"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/cache"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func TestSlotsShowEachViewerTheAdsMeantForThem(t *testing.T) {
	f := newFixture(t, nil)
	f.create(t, adtest.Banner("home", ad.SlotHome))
	adultBanner := adtest.Banner("adult", ad.SlotHome)
	adultBanner.BannerAdult = true
	f.create(t, adultBanner)
	f.create(t, adtest.Side("side"))
	path := "/ad/slots?slot=home&slot=sidebar&slot=home"

	guest := f.server.Do(apitest.Request{Method: http.MethodGet, Path: path})
	f.server.Expect(guest, http.StatusOK, 0)
	want := `[{"slot":"home","ads":[{"id":1,"name":"home","image":"spotlight/banner/home.webp","icon":null}]},{"slot":"sidebar","ads":[{"id":3,"name":"side","image":"spotlight/side/side.webp","icon":"spotlight/icon/side.webp"}]}]`
	if string(guest.Data) != want {
		t.Fatalf("guest slots\n got %s\nwant %s", guest.Data, want)
	}
	var placed []struct {
		Ads []struct {
			ID int `json:"id"`
		} `json:"ads"`
	}
	f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/slots?slot=home", As: &adult}).Decode(t, &placed)
	if len(placed) != 1 || len(placed[0].Ads) != 2 || placed[0].Ads[1].ID != 2 {
		t.Fatalf("adult banners reach viewers who see adult content: %+v", placed)
	}
	for name, request := range map[string]apitest.Request{
		"another language": {Method: http.MethodGet, Path: "/ad/slots?slot=home&locale=en", As: &viewer},
		"a sponsor":        {Method: http.MethodGet, Path: "/ad/slots?slot=home", As: &sponsor},
	} {
		resp := f.server.Do(request)
		f.server.Expect(resp, http.StatusOK, 0)
		if string(resp.Data) != `[{"slot":"home","ads":[]}]` {
			t.Fatalf("%s sees no ads: %s", name, resp.Data)
		}
	}
	settingtest.Set(f.settings, ad.Enabled, false)
	if off := f.server.Do(apitest.Request{Method: http.MethodGet, Path: path}); string(off.Data) != `[{"slot":"home","ads":[]},{"slot":"sidebar","ads":[]}]` {
		t.Fatalf("ads switched off: %s", off.Data)
	}
	for _, bad := range []string{"/ad/slots", "/ad/slots?slot=top", "/ad/slots?slot=home&locale=fr"} {
		f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: bad}), http.StatusUnprocessableEntity, 100101)
	}
}

func TestViewsAndClicksAreCountedOncePerVisitor(t *testing.T) {
	f := newFixture(t, nil)
	f.create(t, adtest.Banner("home", ad.SlotHome))
	seen := map[string]any{"views": []map[string]any{{"ad_id": 1, "slot": "home"}, {"ad_id": 1, "slot": "home"}, {"ad_id": 9, "slot": "home"}, {"ad_id": 1, "slot": "game"}}}
	views := f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/ad/views", Body: seen})
	f.server.Expect(views, http.StatusOK, 0)
	if views.HasData {
		t.Fatalf("views answer without data: %s", views.Body)
	}
	tooMany := make([]map[string]any, 51)
	for i := range tooMany {
		tooMany[i] = map[string]any{"ad_id": 1, "slot": "home"}
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/ad/views", Body: map[string]any{"views": tooMany}}), http.StatusUnprocessableEntity, 100101)

	for _, agent := range []string{"first", "first", "second"} {
		click := f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/ad/1/click", Body: map[string]any{"slot": "home"}, Header: map[string]string{"User-Agent": agent}})
		f.server.Expect(click, http.StatusOK, 0)
		if string(click.Data) != `{"link":"https://example.test/home"}` {
			t.Fatalf("click leads to the ad's link: %s", click.Data)
		}
	}
	rows, err := f.repo.Counts(context.Background(), nil, today, today)
	if err != nil || len(rows) != 1 || rows[0].Slot != ad.SlotHome || rows[0].Counts != (ad.Counts{Views: 2, Clicks: 2}) {
		t.Fatalf("counted today: %+v %v", rows, err)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/ad/9/click", Body: map[string]any{"slot": "home"}}), http.StatusNotFound, 580101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/ad/1/click", Body: map[string]any{"slot": "top"}}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminCreatesReplacesAndDeletesAds(t *testing.T) {
	f := newFixture(t, nil)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad"}), http.StatusUnauthorized, 200101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad", As: &viewer}), http.StatusForbidden, 403)

	draft := func(change func(body map[string]any)) map[string]any {
		body := map[string]any{
			"name": "litpupu", "link": "https://litpupu.test", "banner": "spotlight/banner/a.webp", "banner_adult": false, "side_adult": false,
			"slots": []string{"resource", "home"}, "languages": []string{"ja", "zh"}, "weight": 3, "enabled": true, "start_at": "2026-10-01T00:00:00.000Z",
		}
		if change != nil {
			change(body)
		}
		return body
	}
	created := f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/ad", As: &admin, Body: draft(nil)})
	f.server.Expect(created, http.StatusCreated, 0)
	want := `{"id":1,"name":"litpupu","link":"https://litpupu.test","banner":"spotlight/banner/a.webp","banner_adult":false,"side_image":null,"side_icon":null,"side_adult":false,"slots":["home","resource"],"languages":["zh","ja"],"weight":3,"enabled":true,"status":"running","start_at":"2026-10-01T00:00:00.000Z","end_at":null,"week":{"views":0,"clicks":0},"created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z"}`
	if string(created.Data) != want {
		t.Fatalf("created ad\n got %s\nwant %s", created.Data, want)
	}
	for name, change := range map[string]func(map[string]any){
		"empty name":       func(b map[string]any) { b["name"] = "" },
		"ftp link":         func(b map[string]any) { b["link"] = "ftp://litpupu.test" },
		"empty banner key": func(b map[string]any) { b["banner"] = "" },
		"unknown slot":     func(b map[string]any) { b["slots"] = []string{"top"} },
		"no language":      func(b map[string]any) { b["languages"] = []string{} },
		"heavy weight":     func(b map[string]any) { b["weight"] = 11 },
	} {
		resp := f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/ad", As: &admin, Body: draft(change)})
		if resp.Status != http.StatusUnprocessableEntity || resp.Code != 100101 {
			t.Fatalf("%s: %d %d %s", name, resp.Status, resp.Code, resp.Body)
		}
	}
	for code, change := range map[int]func(map[string]any){
		580102: func(b map[string]any) { b["banner"] = nil },
		580103: func(b map[string]any) { b["side_image"] = "spotlight/side/a.webp" },
		580104: func(b map[string]any) { b["slots"] = []string{"sidebar"} },
		580106: func(b map[string]any) { b["end_at"] = "2026-09-30T00:00:00.000Z" },
	} {
		f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/ad", As: &admin, Body: draft(change)}), http.StatusBadRequest, code)
	}

	replaced := f.server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/ad/1", As: &admin, Body: draft(func(b map[string]any) {
		b["side_image"], b["side_icon"] = "spotlight/side/a.webp", "spotlight/icon/a.webp"
		b["slots"] = []string{"sidebar", "home"}
		b["enabled"] = false
		delete(b, "start_at")
	})})
	f.server.Expect(replaced, http.StatusOK, 0)
	var item struct {
		Slots   []string `json:"slots"`
		Status  string   `json:"status"`
		StartAt *string  `json:"start_at"`
		Icon    string   `json:"side_icon"`
	}
	replaced.Decode(t, &item)
	if len(item.Slots) != 2 || item.Slots[1] != "sidebar" || item.Status != "disabled" || item.StartAt != nil || item.Icon != "spotlight/icon/a.webp" {
		t.Fatalf("replaced ad: %s", replaced.Data)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/1", As: &admin}), http.StatusOK, 0)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/9", As: &admin}), http.StatusNotFound, 580101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/ad/9", As: &admin, Body: draft(nil)}), http.StatusNotFound, 580101)
	deleted := f.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/ad/1", As: &admin})
	f.server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/ad/1", As: &admin}), http.StatusNotFound, 580101)
}

func TestAdminSeesCountsPerAdSlotAndDay(t *testing.T) {
	f := newFixture(t, nil)
	ctx := context.Background()
	first := f.create(t, adtest.Banner("a", ad.SlotHome, ad.SlotGame))
	over := adtest.Banner("b", ad.SlotGame)
	over.EndAt = new(apitest.Now.Add(-time.Hour))
	second := f.create(t, over)
	f.create(t, adtest.Side("c"))
	home, game := ad.View{AdID: first.ID, Slot: ad.SlotHome}, ad.View{AdID: first.ID, Slot: ad.SlotGame}
	earlier, outside := time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC), time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	for _, err := range []error{
		f.repo.AddViews(ctx, today, map[ad.View]int{home: 5, game: 2, {AdID: second.ID, Slot: ad.SlotGame}: 4}),
		f.repo.AddClick(ctx, today, home),
		f.repo.AddViews(ctx, earlier, map[ad.View]int{home: 1}),
		f.repo.AddClick(ctx, earlier, home),
		f.repo.AddViews(ctx, outside, map[ad.View]int{home: 100}),
	} {
		if err != nil {
			t.Fatal(err)
		}
	}
	expectData := func(path, want string) {
		t.Helper()
		resp := f.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &admin})
		f.server.Expect(resp, http.StatusOK, 0)
		if string(resp.Data) != want {
			t.Fatalf("%s\n got %s\nwant %s", path, resp.Data, want)
		}
	}
	var page struct {
		Items []struct {
			ID   int            `json:"id"`
			Week map[string]int `json:"week"`
		} `json:"items"`
	}
	f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?status=running", As: &admin}).Decode(t, &page)
	if len(page.Items) != 2 || page.Items[0].ID != 3 || page.Items[1].ID != first.ID || page.Items[1].Week["views"] != 8 || page.Items[1].Week["clicks"] != 2 {
		t.Fatalf("running ads with their week: %+v", page.Items)
	}
	f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?slot=game", As: &admin}).Decode(t, &page)
	if len(page.Items) != 2 || page.Items[0].ID != second.ID || page.Items[1].ID != first.ID {
		t.Fatalf("ads in the game slot: %+v", page.Items)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?status=paused", As: &admin}), http.StatusUnprocessableEntity, 100101)

	expectData("/admin/ad/overview", `{"running":2,"week":{"views":12,"clicks":2},"enabled":true}`)
	expectData("/admin/ad/slots", `[{"slot":"home","material":"banner","shown":2,"running":[{"id":1,"name":"a"}],"week":{"views":6,"clicks":2}},`+
		`{"slot":"game","material":"banner","shown":2,"running":[{"id":1,"name":"a"}],"week":{"views":6,"clicks":0}},`+
		`{"slot":"resource","material":"banner","shown":2,"running":[],"week":{"views":0,"clicks":0}},`+
		`{"slot":"download","material":"banner","shown":1,"running":[],"week":{"views":0,"clicks":0}},`+
		`{"slot":"sidebar","material":"side","shown":3,"running":[{"id":3,"name":"c"}],"week":{"views":0,"clicks":0}}]`)
	expectData("/admin/ad/1/report?days=7", `{"total":{"views":8,"clicks":2},"days":[`+
		`{"day":"2026-09-27","views":0,"clicks":0},{"day":"2026-09-28","views":0,"clicks":0},{"day":"2026-09-29","views":0,"clicks":0},`+
		`{"day":"2026-09-30","views":1,"clicks":1},{"day":"2026-10-01","views":0,"clicks":0},{"day":"2026-10-02","views":0,"clicks":0},`+
		`{"day":"2026-10-03","views":7,"clicks":1}],"slots":[{"slot":"home","views":6,"clicks":2},{"slot":"game","views":2,"clicks":0}]}`)
	var month struct {
		Total map[string]int `json:"total"`
		Days  []struct {
			Day string `json:"day"`
		} `json:"days"`
	}
	f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/1/report", As: &admin}).Decode(t, &month)
	if len(month.Days) != 30 || month.Days[0].Day != "2026-09-04" || month.Total["views"] != 8 {
		t.Fatalf("thirty days by default: %+v", month)
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/1/report?days=8", As: &admin}), http.StatusUnprocessableEntity, 100101)
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/9/report", As: &admin}), http.StatusNotFound, 580101)
}

func TestWritesDropOnlyTheSlotCaches(t *testing.T) {
	client := redistest.New(t)
	store := cache.New(client)
	f := newFixture(t, store)
	created := f.create(t, adtest.Banner("home", ad.SlotHome))
	ctx := context.Background()
	unrelated := []string{"message:unread:1", "s3-upload:5", "bull:large-file-upload:1"}
	for _, key := range unrelated {
		if err := store.Set(ctx, key, 1, time.Minute); err != nil {
			t.Fatal(err)
		}
	}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/slots?slot=home"}), http.StatusOK, 0)
	var cached []ad.Ad
	if found, _ := store.Get(ctx, ad.SlotCachePrefix+"home", &cached); !found {
		t.Fatal("the slot should be cached")
	}
	body := map[string]any{"name": "home", "link": "https://example.test/home", "banner": "spotlight/banner/home.webp", "banner_adult": false, "side_adult": false, "slots": []string{"home"}, "languages": []string{"zh"}, "weight": 2, "enabled": true}
	f.server.Expect(f.server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/ad/" + strconv.Itoa(created.ID), As: &admin, Body: body}), http.StatusOK, 0)
	if found, _ := store.Get(ctx, ad.SlotCachePrefix+"home", &cached); found {
		t.Fatal("ad writes must drop the slot caches")
	}
	for _, key := range unrelated {
		var value int
		if found, err := store.Get(ctx, key, &value); err != nil || !found {
			t.Fatalf("unrelated key %s was deleted: %v", key, err)
		}
	}
}
