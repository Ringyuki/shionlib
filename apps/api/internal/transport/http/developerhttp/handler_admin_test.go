package developerhttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer/developertest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/developerhttp"
)

func TestAdminListShapeAndFilter(t *testing.T) {
	server := apitest.New(t)
	at := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	store := &developertest.AdminStore{Total: 2, Entries: []developer.AdminEntry{
		{ID: 4, Name: "Yuzusoft", Logo: ptr("logo.webp"), GamesCount: 9, Created: at, Updated: at},
		{ID: 2, Name: "Key", GamesCount: 0, Created: at, Updated: at},
	}}
	developerhttp.NewAdminHandler(developer.NewAdminService(store), server.Builder).Register(server.API)

	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers?search=soft&sortBy=updated&sortOrder=asc", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[` +
		`{"id":4,"name":"Yuzusoft","logo":"logo.webp","gamesCount":9,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"},` +
		`{"id":2,"name":"Key","gamesCount":0,"created":"2026-01-02T03:04:05.000Z","updated":"2026-01-02T03:04:05.000Z"}` +
		`],"meta":{"totalItems":2,"itemCount":2,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("unexpected page\n got %s\nwant %s", resp.Data, want)
	}
	filter, page := store.Last()
	if filter != (developer.AdminFilter{Search: "soft", SortBy: developer.SortByUpdated}) || page != (developer.Page{Number: 1, Size: 10}) {
		t.Fatalf("filter %+v page %+v", filter, page)
	}

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers?sortBy=name", As: &admin}), http.StatusOK, 0)
	if filter, _ := store.Last(); filter != (developer.AdminFilter{SortBy: developer.SortByName, Descending: true}) {
		t.Fatalf("name sort: %+v", filter)
	}
}

func TestAdminListAccessAndValidation(t *testing.T) {
	server := apitest.New(t)
	developerhttp.NewAdminHandler(developer.NewAdminService(&developertest.AdminStore{}), server.Builder).Register(server.API)

	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers", As: &user}), http.StatusForbidden, 403)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers?sortBy=works", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/developers?pageSize=51", As: &admin}), http.StatusUnprocessableEntity, 100101)
}
