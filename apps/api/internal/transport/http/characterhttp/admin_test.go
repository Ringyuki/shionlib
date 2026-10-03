package characterhttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/character/charactertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/characterhttp"
)

func TestAdminListShapeAndFilter(t *testing.T) {
	server := apitest.New(t)
	at := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	store := &charactertest.AdminStore{Total: 12, Entries: []character.AdminEntry{
		{ID: 7, NameJP: "穹", NameEN: ptr("Sora"), Image: ptr("c.webp"), Gender: []string{"f"}, GamesCount: 2, Created: at, Updated: at},
		{ID: 3, NameJP: "名無し", GamesCount: 0, Created: at, Updated: at},
	}}
	characterhttp.NewAdminHandler(character.NewAdminService(store), server.Builder).Register(server.API)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters?page=2&pageSize=5&search=%20so%20&sortBy=name&sortOrder=asc", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":7,"name_jp":"穹","name_zh":null,"name_en":"Sora","image":"c.webp","gender":["f"],"gamesCount":2,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"},` +
		`{"id":3,"name_jp":"名無し","name_zh":null,"name_en":null,"gender":[],"gamesCount":0,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"}` +
		`],"meta":{"totalItems":12,"itemCount":2,"itemsPerPage":5,"totalPages":3,"currentPage":2}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	filter, page := store.Last()
	if filter != (character.AdminFilter{Search: "so", SortBy: character.SortByName}) || page != (character.Page{Number: 2, Size: 5}) {
		t.Fatalf("filter %+v page %+v", filter, page)
	}

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters", As: &admin}), http.StatusOK, 0)
	if filter, page := store.Last(); filter != (character.AdminFilter{SortBy: character.SortByID, Descending: true}) || page != (character.Page{Number: 1, Size: 10}) {
		t.Fatalf("defaults: filter %+v page %+v", filter, page)
	}
}

func TestAdminListAccessAndValidation(t *testing.T) {
	server := apitest.New(t)
	characterhttp.NewAdminHandler(character.NewAdminService(&charactertest.AdminStore{}), server.Builder).Register(server.API)

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters", As: &user}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters?sortBy=name_cn", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters?sortOrder=ASC", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters?pageSize=51", As: &admin}), http.StatusUnprocessableEntity, 100101)
	empty := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/characters", As: &admin})
	server.Expect(empty, http.StatusOK, 0)
	if string(empty.Data) != `{"items":[],"meta":{"totalItems":0,"itemCount":0,"itemsPerPage":10,"totalPages":0,"currentPage":1}}` {
		t.Fatalf("empty page %s", empty.Data)
	}
}
