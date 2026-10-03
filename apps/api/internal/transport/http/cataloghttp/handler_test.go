package cataloghttp_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog/catalogtest"
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
	server := apitest.New(t)
	source := catalogtest.NewSource(catalog.SourceHikarinagi)
	queue := &catalogtest.Queue{}
	service := catalog.NewService([]catalog.Source{source}, catalogtest.NewStore(), &txtest.Immediate{}, queue, func() time.Time { return apitest.Now }, catalog.Options{CreatorID: 1})
	cataloghttp.NewHandler(service, server.Builder).Register(server.API)
	return server, source, queue
}

func TestCatalogRoutesRequireAdmins(t *testing.T) {
	server, _, _ := setup(t)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources"}), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources", As: &user}), http.StatusForbidden, http.StatusForbidden)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/sources", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `["hikarinagi"]` {
		t.Fatalf("sources %s", resp.Data)
	}
}

func TestSearchReturnsAPage(t *testing.T) {
	server, source, _ := setup(t)
	cover := "https://cdn.test/c.webp"
	source.Hits = []catalog.SearchHit{{ExternalID: "77", Title: "サクラノ詩", CoverURL: &cover}, {ExternalID: "78", Title: "続"}}
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search?q=sakura&pageSize=1", As: &admin})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"items":[{"external_id":"77","title":"サクラノ詩","subtitle":null,"developer":null,"cover":"https://cdn.test/c.webp"}],"meta":{"totalItems":2,"itemCount":1,"itemsPerPage":1,"totalPages":2,"currentPage":1}}`
	if string(resp.Data) != want {
		t.Fatalf("search %s", resp.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/catalog/search", As: &admin}), http.StatusUnprocessableEntity, 100101)
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
}
