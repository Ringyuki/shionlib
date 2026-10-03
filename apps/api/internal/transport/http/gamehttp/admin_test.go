package gamehttp_test

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	staff   = actor.Actor{UserID: 50, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitNeverShow}
	created = time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC)
)

type adminEnv struct {
	server     *apitest.Server
	store      *gametest.AdminStore
	recent     *gametest.RecentMarks
	exclusions *gametest.Exclusions
	purger     *gametest.Purger
}

func newAdminEnv(t *testing.T) adminEnv {
	t.Helper()
	cover := "cover.webp"
	first := gametest.AdminGame{
		Entry:  game.AdminEntry{ID: 1, TitleJP: "サマポケ", TitleZH: "夏日口袋", Status: game.StatusVisible, Views: 9, Downloads: 3, Created: created, Updated: created, CoverURL: &cover, Creator: game.CreatorRef{ID: 7, Name: "importer"}},
		Scalar: game.Scalar{BID: ptr("100"), VID: ptr("v100"), Aliases: []string{"SP"}, ReleaseDate: &released, ExtraInfo: json.RawMessage(`[{"key":"k","value":"v"}]`), Platform: []string{"win"}, Type: ptr("ADV")},
		Keys:   []string{"games/1/1/a.7z"},
	}
	second := gametest.AdminGame{Entry: game.AdminEntry{ID: 2, TitleJP: "Hidden", Status: game.StatusHidden, NSFW: true, Created: created, Updated: created, Creator: game.CreatorRef{ID: 7, Name: "importer"}}}
	env := adminEnv{
		server:     apitest.New(t),
		store:      gametest.NewAdminStore(first, second),
		recent:     gametest.NewRecentMarks(),
		exclusions: &gametest.Exclusions{},
		purger:     &gametest.Purger{},
	}
	service := game.NewAdminService(env.store, env.recent, env.exclusions, env.purger, &txtest.Immediate{}, func() time.Time { return apitest.Now })
	gamehttp.NewAdminHandler(service, env.server.Builder).Register(env.server.API)
	return env
}

func TestAdminGameRoutesRequireAnAdministrator(t *testing.T) {
	env := newAdminEnv(t)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games"}), http.StatusUnauthorized, 200101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/games/1", As: &strict}), http.StatusForbidden, 403)
	if _, ok := env.store.Game(1); !ok {
		t.Fatal("a regular user deleted a game")
	}
}

func TestAdminGameListShape(t *testing.T) {
	env := newAdminEnv(t)
	resp := env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games?pageSize=1", As: &staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"id":2,"title_jp":"Hidden","title_zh":"","title_en":"","status":2,"views":0,"downloads":0,"nsfw":true,"created":"2025-01-02T03:04:05Z","updated":"2025-01-02T03:04:05Z","covers":[],"creator":{"id":7,"name":"importer"}}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":1,"totalPages":2,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("default order is id desc\n got %s\nwant %s", resp.Data, want)
	}
	resp = env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games?status=1&search=%E5%A4%8F&sortBy=views&sortOrder=asc", As: &staff})
	want = `{"items":[{"id":1,"title_jp":"サマポケ","title_zh":"夏日口袋","title_en":"","status":1,"views":9,"downloads":3,"nsfw":false,"created":"2025-01-02T03:04:05Z","updated":"2025-01-02T03:04:05Z","covers":[{"url":"cover.webp"}],"creator":{"id":7,"name":"importer"},"cover":"cover.webp"}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("filtered\n got %s\nwant %s", resp.Data, want)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games?status=3", As: &staff}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games?sortBy=hot_score", As: &staff}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminGameStatus(t *testing.T) {
	env := newAdminEnv(t)
	resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/1/status", As: &staff, Body: map[string]any{"status": 2}})
	env.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("void response: %s", resp.Body)
	}
	if stored, _ := env.store.Game(1); stored.Entry.Status != game.StatusHidden {
		t.Fatalf("status not stored: %+v", stored.Entry)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/99/status", As: &staff, Body: map[string]any{"status": 1}}), http.StatusNotFound, 400101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/1/status", As: &staff, Body: map[string]any{"status": 3}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/1/status", As: &staff, Body: map[string]any{"status": "2"}}), http.StatusUnprocessableEntity, 100101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/abc/status", As: &staff, Body: map[string]any{"status": 1}}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminGameScalarRead(t *testing.T) {
	env := newAdminEnv(t)
	resp := env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/1/edit/scalar", As: &staff})
	env.server.Expect(resp, http.StatusOK, 0)
	want := `{"b_id":"100","v_id":"v100","title_jp":"サマポケ","title_zh":"","title_en":"","aliases":["SP"],"intro_jp":"","intro_zh":"","intro_en":"","release_date":"2024-05-01T00:00:00Z","release_date_tba":false,"extra_info":[{"key":"k","value":"v"}],"staffs":null,"nsfw":false,"type":"ADV","platform":["win"],"status":1}`
	if string(resp.Data) != want {
		t.Fatalf("scalar\n got %s\nwant %s", resp.Data, want)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/99/edit/scalar", As: &staff}), http.StatusNotFound, 400101)
}

func TestAdminGameScalarEdit(t *testing.T) {
	env := newAdminEnv(t)
	path := "/admin/content/games/1/edit/scalar"
	resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &staff, Body: map[string]any{
		"b_id": "", "v_id": "  ", "type": " ", "title_zh": "新", "aliases": []string{}, "release_date": "", "extra_info": nil, "staffs": []map[string]string{{"name": "n", "role": "r"}},
		"platform": []string{"win", "linux"}, "nsfw": true, "status": 2, "tags": []string{}, "ignored_field": 1,
	}})
	env.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("void response: %s", resp.Body)
	}
	stored, _ := env.store.Game(1)
	scalar := stored.Scalar
	if scalar.BID != nil || scalar.VID != nil || scalar.Type != nil || scalar.ReleaseDate != nil || scalar.TitleZH != "新" || len(scalar.Aliases) != 0 ||
		!slices.Equal(scalar.Platform, []string{"win", "linux"}) || !scalar.NSFW || scalar.Status != game.StatusHidden || scalar.TitleJP != "サマポケ" {
		t.Fatalf("normalized edit: %+v", scalar)
	}
	if string(scalar.ExtraInfo) != `[]` || string(scalar.Staffs) != `[{"Name":"n","Role":"r"}]` {
		t.Fatalf("json columns: %s %s", scalar.ExtraInfo, scalar.Staffs)
	}

	resp = env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &staff, Body: map[string]any{"release_date": "2026-02-10T08:00:00+08:00"}})
	env.server.Expect(resp, http.StatusOK, 0)
	if stored, _ = env.store.Game(1); stored.Scalar.ReleaseDate == nil || !stored.Scalar.ReleaseDate.Equal(time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("release date: %v", stored.Scalar.ReleaseDate)
	}

	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &staff, Body: map[string]any{}}), http.StatusOK, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/99/edit/scalar", As: &staff, Body: map[string]any{}}), http.StatusNotFound, 400101)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/games/2/edit/scalar", As: &staff, Body: map[string]any{"b_id": "100", "v_id": "v100"}}), http.StatusOK, 0)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &staff, Body: map[string]any{"b_id": "100", "v_id": "v100"}}), http.StatusConflict, 400105)
	for name, body := range map[string]map[string]any{
		"date":         {"release_date": "2026-02-10"},
		"aliases":      {"aliases": "SP"},
		"long title":   {"title_jp": strings.Repeat("a", 256)},
		"extra shape":  {"extra_info": []map[string]any{{"key": "k"}}},
		"extra fields": {"staffs": []map[string]any{{"name": "n", "role": "r", "x": 1}}},
		"status":       {"status": 3},
		"number id":    {"b_id": 100},
	} {
		resp := env.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &staff, Body: body})
		if resp.Status != http.StatusUnprocessableEntity || resp.Code != 100101 {
			t.Fatalf("%s: %d %s", name, resp.Status, resp.Body)
		}
	}
}

func TestAdminGameDelete(t *testing.T) {
	env := newAdminEnv(t)
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/content/games/1/recent-update", As: &staff}), http.StatusOK, 0)
	resp := env.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/games/1", As: &staff})
	env.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("void response: %s", resp.Body)
	}
	if _, ok := env.store.Game(1); ok {
		t.Fatal("game not deleted")
	}
	if got := env.exclusions.Excluded(); !slices.Equal(got, []gametest.Exclusion{{Entity: catalog.EntityGame, ID: 1}}) {
		t.Fatalf("catalog exclusion: %+v", got)
	}
	if _, marked := env.recent.MarkedAt(1); marked {
		t.Fatal("recent update kept")
	}
	if got := env.purger.Purged(); len(got) != 1 || !slices.Equal(got[0], []string{"games/1/1/a.7z"}) {
		t.Fatalf("purge: %v", got)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/games/1", As: &staff}), http.StatusNotFound, 400101)
}

func TestAdminGameRecentUpdates(t *testing.T) {
	env := newAdminEnv(t)
	resp := env.server.Do(apitest.Request{Method: http.MethodPut, Path: "/admin/content/games/77/recent-update", As: &staff})
	env.server.Expect(resp, http.StatusOK, 0)
	if at, ok := env.recent.MarkedAt(77); !ok || !at.Equal(apitest.Now) || resp.HasData {
		t.Fatalf("mark: %v %v %s", at, ok, resp.Body)
	}
	env.server.Expect(env.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/games/77/recent-update", As: &staff}), http.StatusOK, 0)
	if _, ok := env.recent.MarkedAt(77); ok {
		t.Fatal("unmark")
	}
}
