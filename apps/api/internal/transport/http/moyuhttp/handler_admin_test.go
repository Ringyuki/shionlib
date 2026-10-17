package moyuhttp_test

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu/moyutest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/moyuhttp"
)

var staff = actor.Actor{UserID: 50, Role: actor.RoleAdmin}

func newAdminServer(t *testing.T) (*apitest.Server, *moyutest.Assignments, *moyutest.Patches) {
	t.Helper()
	server := apitest.New(t)
	assignments := &moyutest.Assignments{Games: map[int]moyu.Game{
		11110: {Anchors: []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v1141"}, {Source: moyu.SourceBangumi, ID: "15004"}}},
		27697: {Assigned: true, Pages: []string{"212857"}},
	}}
	patches := &moyutest.Patches{
		Known: map[moyu.Anchor][]string{{Source: moyu.SourceVNDB, ID: "v1141"}: {"3125"}, {Source: moyu.SourceBangumi, ID: "15004"}: {"215305"}},
		Catalog: []moyu.Page{
			{ID: "3125", URL: "https://www.moyu.moe/galgame/3125", VNDBID: "v1141", WorkID: "3125", Title: "俺たちに翼はない", Resources: 5},
			{ID: "215305", URL: "https://www.moyu.moe/galgame/215305", VNDBID: "wiki-215305", WorkID: "215305", Title: "俺たちに翼はない R", Resources: 1},
			{ID: "212857", URL: "https://www.moyu.moe/galgame/212857", VNDBID: "wiki-212857", Resources: 1},
		},
	}
	moyuhttp.NewAdminHandler(moyu.NewAssignmentService(assignments, patches, moyutest.NewCache()), server.Builder).Register(server.API)
	return server, assignments, patches
}

func TestAnAdministratorReadsThePagesOfAGame(t *testing.T) {
	server, _, _ := newAdminServer(t)
	resp := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/11110/patch-pages", As: &staff})
	server.Expect(resp, http.StatusOK, 0)
	want := `{"manual":false,"vndb_id":"v1141","bangumi_id":"15004","matched":[` +
		`{"id":"3125","url":"https://www.moyu.moe/galgame/3125","title":"俺たちに翼はない","resources":5,"via":{"source":"vndb","id":"v1141"}},` +
		`{"id":"215305","url":"https://www.moyu.moe/galgame/215305","title":"俺たちに翼はない R","resources":1,"via":{"source":"bangumi","id":"15004"}}],"assigned":[]}`
	if string(resp.Data) != want {
		t.Fatalf("pages:\n%s\nwant\n%s", resp.Data, want)
	}
	assigned := server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/27697/patch-pages", As: &staff})
	server.Expect(assigned, http.StatusOK, 0)
	if !strings.HasPrefix(string(assigned.Data), `{"manual":true,"vndb_id":null,"bangumi_id":null,"matched":[],"assigned":[{"id":"212857","url":"https://www.moyu.moe/galgame/212857","title":null,"resources":1,"via":null}]`) {
		t.Fatalf("assigned: %s", assigned.Data)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/404/patch-pages", As: &staff}), http.StatusNotFound, 400101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/games/11110/patch-pages", As: &actor.Actor{UserID: 9, Role: actor.RoleUser}}), http.StatusForbidden, http.StatusForbidden)
}

func TestAnAdministratorAssignsPages(t *testing.T) {
	server, assignments, _ := newAdminServer(t)
	path := "/admin/content/games/11110/patch-pages"
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &staff, Body: map[string]any{"manual": true, "pages": []string{"215305"}}}), http.StatusOK, 0)
	if game := assignments.Games[11110]; !game.Assigned || !slices.Equal(game.Pages, []string{"215305"}) || assignments.By[11110] != staff.UserID {
		t.Fatalf("assigned: %+v %v", game, assignments.By)
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &staff, Body: map[string]any{"manual": true, "pages": []string{"9"}}}), http.StatusUnprocessableEntity, 610104)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &staff, Body: map[string]any{"manual": true, "pages": make([]string, moyu.MaxPages+1)}}), http.StatusUnprocessableEntity, 100101)
	server.Expect(server.Do(apitest.Request{Method: http.MethodPut, Path: path, As: &staff, Body: map[string]any{"manual": false, "pages": []string{}}}), http.StatusOK, 0)
	if assignments.Games[11110].Assigned {
		t.Fatalf("back to the ids: %+v", assignments.Games[11110])
	}
}

func TestALookupNamesTheAddressThatFindsNothing(t *testing.T) {
	server, _, _ := newAdminServer(t)
	path := "/admin/content/patch-pages/lookup"
	found := server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &staff, Body: map[string]any{"address": "https://www.moyu.moe/galgame/215305"}})
	server.Expect(found, http.StatusOK, 0)
	if string(found.Data) != `{"id":"215305","url":"https://www.moyu.moe/galgame/215305","title":"俺たちに翼はない R","resources":1,"via":null}` {
		t.Fatalf("lookup: %s", found.Data)
	}
	for address, code := range map[string]int{"https://www.moyu.moe/galgame/2116520": 610104, "俺たちに翼はない": 610103} {
		refused := server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &staff, Body: map[string]any{"address": address}})
		server.Expect(refused, http.StatusUnprocessableEntity, code)
		if !strings.Contains(string(refused.Data), `"field":"address"`) {
			t.Fatalf("%s: the address field carries the reason: %s", address, refused.Data)
		}
	}
	server.Expect(server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &staff, Body: map[string]any{"address": ""}}), http.StatusUnprocessableEntity, 100101)
}
