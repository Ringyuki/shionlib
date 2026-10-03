package adhttp_test

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad/adtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/cache"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

var (
	viewer  = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	sponsor = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	admin   = actor.Actor{UserID: 3, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
)

func setup(t *testing.T, store ad.Cache) (*apitest.Server, *adtest.MemoryRepository) {
	t.Helper()
	server := apitest.New(t)
	repo := adtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	repo.SetSponsor(sponsor.UserID, apitest.Now.Add(time.Hour))
	if store == nil {
		store = adtest.NewCache()
	}
	adhttp.NewHandler(ad.NewService(repo, repo, store, func() time.Time { return apitest.Now }), server.Builder).Register(server.API)
	return server, repo
}

func seed(t *testing.T, repo *adtest.MemoryRepository) ad.Ad {
	t.Helper()
	ja := "ja.webp"
	created, err := repo.Create(context.Background(), ad.NewAd{Name: "banner", Placement: []string{"home-after-hot"}, ImageZH: "zh.webp", ImageJA: &ja, Aspect: "16:9", Link: "https://x.test", ExcludeLocales: []string{"en"}, Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	return created
}

func TestPlacementShape(t *testing.T) {
	server, repo := setup(t, nil)
	seed(t, repo)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/placement/home-after-hot", As: &viewer})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `[{"id":1,"image_zh":"zh.webp","image_ja":"ja.webp","image_en":null,"aspect":"16:9","link":"https://x.test","exclude_locales":["en"]}]` {
		t.Fatalf("unexpected placement %s", resp.Data)
	}
	sponsored := server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/placement/home-after-hot", As: &sponsor})
	server.Expect(sponsored, http.StatusOK, 0)
	if string(sponsored.Data) != `[]` {
		t.Fatalf("sponsors get no ads: %s", sponsored.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/placement/" + strings.Repeat("x", 101)}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminCRUD(t *testing.T) {
	server, repo := setup(t, nil)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad", As: &viewer}), http.StatusForbidden, 403)

	created := server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/ad", As: &admin, Body: map[string]any{
		"name": "banner", "placement": []string{"home"}, "image_zh": "zh.webp", "aspect": "16:9", "link": "https://x.test", "start_at": "2026-10-01T00:00:00.000Z",
	}})
	server.Expect(created, http.StatusCreated, 0)
	want := `{"id":1,"name":"banner","placement":["home"],"image_zh":"zh.webp","image_ja":null,"image_en":null,"aspect":"16:9","link":"https://x.test","exclude_locales":[],"enabled":true,"sort":0,"start_at":"2026-10-01T00:00:00Z","end_at":null,"created":"2026-10-03T01:02:03Z","updated":"2026-10-03T01:02:03Z"}`
	if string(created.Data) != want {
		t.Fatalf("unexpected created ad\n got %s\nwant %s", created.Data, want)
	}
	for _, body := range []map[string]any{
		{"placement": []string{}, "image_zh": "z", "aspect": "a", "link": "l"},
		{"name": "x", "placement": []string{}, "image_zh": "z", "aspect": "123456789012345678901", "link": "l"},
		{"name": "x", "placement": []string{}, "image_zh": "z", "aspect": "a", "link": "l", "start_at": ""},
		{"name": "x", "placement": []string{}, "image_zh": "z", "aspect": "a", "link": "l", "sort": 1.5},
	} {
		server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/ad", As: &admin, Body: body}), http.StatusUnprocessableEntity, 100101)
	}

	updated := server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/ad/1", As: &admin, Body: map[string]any{"start_at": nil, "image_en": "en.webp", "enabled": false}})
	server.Expect(updated, http.StatusOK, 0)
	var item map[string]any
	updated.Decode(t, &item)
	if item["start_at"] != nil || item["image_en"] != "en.webp" || item["enabled"] != false || item["name"] != "banner" {
		t.Fatalf("null clears and absent fields stay: %s", updated.Data)
	}
	cleared := server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/ad/1", As: &admin, Body: map[string]any{"image_en": nil}})
	server.Expect(cleared, http.StatusOK, 0)
	cleared.Decode(t, &item)
	if item["image_en"] != nil {
		t.Fatalf("image_en should be cleared: %s", cleared.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/ad/9", As: &admin, Body: map[string]any{"name": "x"}}), http.StatusNotFound, 580101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/9", As: &admin}), http.StatusNotFound, 580101)

	seed(t, repo)
	list := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?enabled=true&placement=home-after-hot&sortBy=sort&sortOrder=asc", As: &admin})
	server.Expect(list, http.StatusOK, 0)
	var page struct {
		Items []map[string]any `json:"items"`
		Meta  map[string]int   `json:"meta"`
	}
	list.Decode(t, &page)
	if len(page.Items) != 1 || page.Items[0]["id"] != float64(2) || page.Meta["totalItems"] != 1 {
		t.Fatalf("unexpected admin list %s", list.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?enabled=yes", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad?sortBy=name", As: &admin}), http.StatusUnprocessableEntity, 100101)

	detail := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/ad/2", As: &admin})
	server.Expect(detail, http.StatusOK, 0)
	deleted := server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/ad/2", As: &admin})
	server.Expect(deleted, http.StatusOK, 0)
	if deleted.HasData {
		t.Fatalf("void endpoints omit data: %s", deleted.Body)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/ad/2", As: &admin}), http.StatusNotFound, 580101)
}

func TestInvalidationKeepsUnrelatedRedisKeys(t *testing.T) {
	client := redistest.New(t)
	store := cache.New(client)
	server, repo := setup(t, store)
	created := seed(t, repo)
	ctx := context.Background()
	unrelated := []string{"message:unread:1", "s3-upload:5", "bull:large-file-upload:1"}
	for _, key := range unrelated {
		if err := store.Set(ctx, key, 1, time.Minute); err != nil {
			t.Fatal(err)
		}
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/ad/placement/home-after-hot"}), http.StatusOK, 0)
	var cached []ad.Ad
	if found, _ := store.Get(ctx, "ad:placement:home-after-hot", &cached); !found {
		t.Fatal("placement should be cached")
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/ad/" + strconv.Itoa(created.ID), As: &admin, Body: map[string]any{"sort": 2}}), http.StatusOK, 0)
	if found, _ := store.Get(ctx, "ad:placement:home-after-hot", &cached); found {
		t.Fatal("ad writes must drop placement caches")
	}
	for _, key := range unrelated {
		var value int
		if found, err := store.Get(ctx, key, &value); err != nil || !found {
			t.Fatalf("unrelated key %s was deleted: %v", key, err)
		}
	}
}
