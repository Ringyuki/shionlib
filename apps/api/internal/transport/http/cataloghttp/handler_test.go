package cataloghttp_test

import (
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/cataloghttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	admin = actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitJustShow}
	user  = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

func setup(t *testing.T) (*apitest.Server, *catalogtest.Source, *catalogtest.Queue) {
	t.Helper()
	server, source, queue, _ := setupWithStore(t)
	return server, source, queue
}

func setupWithStore(t *testing.T) (*apitest.Server, *catalogtest.Source, *catalogtest.Queue, *catalogtest.Store) {
	t.Helper()
	server := apitest.New(t)
	source := catalogtest.NewSource(catalog.SourceHikarinagi)
	queue := &catalogtest.Queue{}
	store := catalogtest.NewStore()
	service := catalog.NewService(catalog.Deps{
		Sources:  []catalog.Source{source},
		Store:    store,
		Tx:       &txtest.Immediate{},
		Queue:    queue,
		Now:      func() time.Time { return apitest.Now },
		Settings: settingtest.Source{},
		Options:  catalog.Options{CreatorID: 1},
	})
	cataloghttp.NewHandler(service, server.Builder).Register(server.API)
	return server, source, queue, store
}

func TestCatalogRoutesRequireAdmins(t *testing.T) {
	server, _, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources", As: &user}), http.StatusForbidden, http.StatusForbidden)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `[{"name":"hikarinagi","incremental":true,"games":0,"developers":0,"characters":0,"cursor":"","pulled_at":null,"changes":0,"failed_at":null,"last_error":null,"refresh_seconds":604800}]`
	if string(resp.Data) != want {
		t.Fatalf("sources %s", resp.Data)
	}
	for _, path := range []string{"/admin/catalog/excluded"} {
		server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: path}), http.StatusUnauthorized, 200101)
		server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &user}), http.StatusForbidden, http.StatusForbidden)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/sources/hikarinagi/sync", As: &user}), http.StatusForbidden, http.StatusForbidden)
}

func TestSyncPullsASourceAndReportsWhatItFound(t *testing.T) {
	server, source, queue, store := setupWithStore(t)
	store.Seed(catalog.Ref{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "10"}, nil)
	source.Feed[""] = catalog.ChangeBatch{
		Changes: []catalog.Change{{Entity: catalog.EntityGame, ExternalID: "10", Kind: catalog.ChangeUpsert}, {Entity: catalog.EntityGame, ExternalID: "11", Kind: catalog.ChangeUpsert}},
		Cursor:  "135875",
	}
	resp := server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/sources/hikarinagi/sync", As: &admin})
	server.Expect(resp, http.StatusCreated, 0)
	want := `{"name":"hikarinagi","incremental":true,"games":1,"developers":0,"characters":0,"cursor":"135875","pulled_at":"2026-10-03T01:02:03.000Z","changes":2,"failed_at":null,"last_error":null,"refresh_seconds":604800}`
	if string(resp.Data) != want {
		t.Fatalf("sync\n got %s\nwant %s", resp.Data, want)
	}
	if len(queue.Jobs) != 2 {
		t.Fatalf("jobs %+v", queue.Jobs)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/sources/vndb/sync", As: &admin}), http.StatusBadRequest, 620102)
	source.Err = errors.New("connection refused")
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/sources/hikarinagi/sync", As: &admin}), http.StatusBadGateway, 620101)
	listed := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources", As: &admin})
	if !strings.Contains(string(listed.Data), `"failed_at":"2026-10-03T01:02:03.000Z","last_error":"connection refused"`) {
		t.Fatalf("a failed pull is kept: %s", listed.Data)
	}
}

func TestExcludedEntriesAreListed(t *testing.T) {
	server, _, _, store := setupWithStore(t)
	ref := catalog.Ref{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "21004"}
	id := store.Seed(ref, nil)
	if err := store.Exclude(t.Context(), catalog.EntityGame, id, catalog.Exclusion{Title: "テスト用エントリ", UserID: 1}, apitest.Now); err != nil {
		t.Fatal(err)
	}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/excluded", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"source":"hikarinagi","entity":"game","external_id":"21004","title":"テスト用エントリ","excluded_at":"2026-10-03T01:02:03.000Z","excluded_by":{"id":1,"name":""}}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("excluded\n got %s\nwant %s", resp.Data, want)
	}
}

func TestSearchReturnsAPage(t *testing.T) {
	server, source, _ := setup(t)
	cover := "https://cdn.test/c.webp"
	source.Hits[catalog.EntityGame] = []catalog.SearchHit{{ExternalID: "77", Title: "サクラノ詩", CoverURL: &cover}, {ExternalID: "78", Title: "続"}}
	source.Hits[catalog.EntityDeveloper] = []catalog.SearchHit{{ExternalID: "5", Title: "枕"}}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=sakura&pageSize=1", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"external_id":"77","title":"サクラノ詩","subtitle":null,"developer":null,"cover":"https://cdn.test/c.webp","local_id":null,"excluded":false}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":1,"totalPages":2,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("search %s", resp.Data)
	}
	numbered := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=25085&pageSize=1", As: &admin})
	server.Expect(numbered, http.StatusOK, 0)
	if !strings.HasPrefix(string(numbered.Data), `{"items":[{"external_id":"25085","title":"","subtitle":null,"developer":null,"cover":null,"local_id":null,"excluded":false},{"external_id":"77"`) {
		t.Fatalf("search by number %s", numbered.Data)
	}
	developers := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=makura&entity=developer", As: &admin})
	server.Expect(developers, http.StatusOK, 0)
	if !strings.Contains(string(developers.Data), `"external_id":"5"`) {
		t.Fatalf("developer search %s", developers.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=x&entity=tag", As: &admin}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=x&source=vndb", As: &admin}), http.StatusBadRequest, 620102)
}

func TestImportNowAndQueue(t *testing.T) {
	server, source, queue := setup(t)
	source.Games["77"] = catalog.GameSnapshot{ExternalID: "77", Title: catalog.Localized{Origin: "サクラノ詩"}}
	resp := server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/import", As: &admin, Body: map[string]any{"entity": "game", "external_id": "77"}})
	server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"id":1}` {
		t.Fatalf("import %s", resp.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/import", As: &admin, Body: map[string]any{"entity": "game", "external_id": "404"}}), http.StatusNotFound, 620103)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/import", As: &admin, Body: map[string]any{"entity": "tag", "external_id": "1"}}), http.StatusUnprocessableEntity, 100101)

	queued := server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/import/queue", As: &admin, Body: map[string]any{"source": "hikarinagi", "entity": "developer", "external_id": "5"}})
	server.Expect(queued, http.StatusCreated, 0)
	if queued.HasData {
		t.Fatalf("queue returns no data: %s", queued.Body)
	}
	if len(queue.Jobs) != 1 || queue.Jobs[0] != (catalog.ImportJob{Source: "hikarinagi", Entity: catalog.EntityDeveloper, ExternalID: "5"}) {
		t.Fatalf("jobs %+v", queue.Jobs)
	}

	source.Err = errors.New("connection refused")
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/catalog/import", As: &admin, Body: map[string]any{"entity": "game", "external_id": "78"}}), http.StatusBadGateway, 620101)
}
