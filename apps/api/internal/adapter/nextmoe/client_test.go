package nextmoe_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/nextmoe"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestEntries(t *testing.T) {
	var gotURI, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI, gotAuth = r.URL.RequestURI(), r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"object":"list","items":[{"object":"patch","id":"p1","resources":[` +
			`{"object":"patch_resource","id":"r1","name":" 汉化补丁 ","type":["manual"],"web_url":"https://www.moyu.moe/resource/r1","updated_at":"2026-07-09T08:00:00Z","extra":{"ignored":true}},` +
			`{"object":"patch_resource","id":7,"web_url":"https://www.moyu.moe/resource/7","updated_at":"2026-07-09T08:00:00Z"}` +
			`]},{"object":"patch","id":"p2","resources":[{"id":"r2","type":["save"],"web_url":"https://www.moyu.moe/resource/r2","updated_at":"2025-09-25T00:00:00+08:00"}]},` +
			`{"object":"patch","id":"p2","resources":[{"id":"r2","type":["save"],"web_url":"https://www.moyu.moe/resource/r2","updated_at":"2025-09-25T00:00:00+08:00"}]}],"next_cursor":null,"total":null,"missing":[]}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL+"/", "nmk_test_key")
	entries, err := client.Entries(context.Background(), moyu.PageQuery{VNDBID: "v4145", Works: []string{"61311", "212857"}})
	if err != nil {
		t.Fatal(err)
	}
	if gotURI != "/v2/moyu/patches?include=resources%2Cpublisher&nsfw=true&refs=vndb%3Av4145%2Ccatalog%3A61311%2Ccatalog%3A212857" || gotAuth != "Bearer nmk_test_key" {
		t.Fatalf("unexpected request %s %s", gotURI, gotAuth)
	}
	if len(entries) != 2 || entries[0].ID != "r1" || entries[0].Name != "汉化补丁" || entries[1].ID != "r2" || entries[1].Kind != moyu.KindSave {
		t.Fatalf("every page's resources are read once and one that cannot be read is left out: %+v", entries)
	}
	if !entries[1].Updated.Equal(time.Date(2025, 9, 24, 16, 0, 0, 0, time.UTC)) {
		t.Fatalf("updated: %v", entries[1].Updated)
	}
	if _, err := client.Entries(context.Background(), moyu.PageQuery{Works: []string{"212857"}}); err != nil || gotURI != "/v2/moyu/patches?include=resources%2Cpublisher&nsfw=true&refs=catalog%3A212857" {
		t.Fatalf("a page whose game is not on vndb is found by its work: %s %v", gotURI, err)
	}
	if _, err := client.Entries(context.Background(), moyu.PageQuery{VNDBID: "v4145", IDs: []string{"212857", "212857", "x", "3125"}}); err != nil || gotURI != "/v2/moyu/patches?ids=212857%2C3125&include=resources%2Cpublisher&nsfw=true" {
		t.Fatalf("pages assigned by hand are asked for by their ids alone: %s %v", gotURI, err)
	}
	gotURI = ""
	none, err := client.Entries(context.Background(), moyu.PageQuery{VNDBID: " ", Works: []string{"", "1,2"}, IDs: []string{"x"}})
	if err != nil || none == nil || len(none) != 0 || gotURI != "" {
		t.Fatalf("nothing to look for asks for nothing, not for every page: %s %+v %v", gotURI, none, err)
	}
}

func TestWorks(t *testing.T) {
	var gotURI string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI = r.URL.RequestURI()
		_, _ = w.Write([]byte(`{"object":"list","items":[{"object":"work","id":"212857","display_name":"x"},{"object":"work","id":"1, 2"},{"object":"work","id":""},{"object":"work","id":"212857"},{"object":"work","id":"61311"}],"missing":[]}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL, "k")
	works, err := client.Works(context.Background(), []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v4145"}, {Source: moyu.SourceBangumi, ID: "700741"}, {Source: "steam", ID: "1"}})
	if err != nil || !slices.Equal(works, []string{"212857", "61311"}) {
		t.Fatalf("works: %v %v", works, err)
	}
	if gotURI != "/v2/catalog/works?nsfw=true&refs=vndb%3Av4145%2Cbangumi%3A700741" {
		t.Fatalf("every id is asked about at once: %s", gotURI)
	}
	gotURI = ""
	for _, anchors := range [][]moyu.Anchor{nil, {{Source: "steam", ID: "1"}}, {{Source: moyu.SourceVNDB, ID: ""}}} {
		if works, err := client.Works(context.Background(), anchors); err != nil || works == nil || len(works) != 0 || gotURI != "" {
			t.Fatalf("%+v: %v %v %s", anchors, works, err, gotURI)
		}
	}
}

func TestPages(t *testing.T) {
	var asked []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.RequestURI())
		if r.URL.Path == "/v2/catalog/works" {
			_, _ = w.Write([]byte(`{"object":"list","items":[{"object":"work","id":"3125","display_name":" 俺たちに翼はない "},{"object":"work","id":"215305","display_name":"俺たちに翼はない R"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"object":"list","items":[` +
			`{"object":"patch","id":"3125","vndb_id":"v1141","catalog_work_id":"3125","resource_count":5,"web_url":"https://www.moyu.moe/galgame/3125"},` +
			`{"object":"patch","id":"215305","vndb_id":"wiki-215305","catalog_work_id":"215305","resource_count":1,"web_url":"https://www.moyu.moe/galgame/215305"},` +
			`{"object":"patch","id":"3125","vndb_id":"v1141","catalog_work_id":"3125","resource_count":5,"web_url":"https://www.moyu.moe/galgame/3125"},` +
			`{"object":"patch","id":"9","vndb_id":"pending-9","catalog_work_id":null,"resource_count":-1,"web_url":"https://www.moyu.moe/galgame/9"},` +
			`{"object":"patch","id":"x","web_url":"https://www.moyu.moe/galgame/x"},{"object":"patch","id":"10","web_url":"javascript:alert(1)"}]}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL, "k")
	pages, err := client.Pages(context.Background(), moyu.PageQuery{VNDBID: "v1141", Works: []string{"215305"}})
	if err != nil || len(pages) != 3 {
		t.Fatalf("pages: %+v %v", pages, err)
	}
	if !slices.Equal(asked, []string{"/v2/moyu/patches?nsfw=true&refs=vndb%3Av1141%2Ccatalog%3A215305", "/v2/catalog/works?ids=3125%2C215305&nsfw=true"}) {
		t.Fatalf("the pages, then the names of their works: %v", asked)
	}
	original, edition, placeholder := pages[0], pages[1], pages[2]
	if original != (moyu.Page{ID: "3125", URL: "https://www.moyu.moe/galgame/3125", VNDBID: "v1141", WorkID: "3125", Title: "俺たちに翼はない", Resources: 5}) || edition.Title != "俺たちに翼はない R" {
		t.Fatalf("pages with their works: %+v %+v", original, edition)
	}
	if placeholder.WorkID != "" || placeholder.Title != "" || placeholder.Resources != 0 {
		t.Fatalf("a page filed under no work: %+v", placeholder)
	}
	asked = nil
	if _, err := client.Pages(context.Background(), moyu.PageQuery{IDs: []string{"212857"}}); err != nil || asked[0] != "/v2/moyu/patches?ids=212857&nsfw=true" {
		t.Fatalf("by id: %v %v", asked, err)
	}
}

func TestPageOfResource(t *testing.T) {
	var gotURI string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI = r.URL.RequestURI()
		if r.URL.Path == "/v2/moyu/resources/11421" {
			_, _ = w.Write([]byte(`{"object":"patch_resource","id":"11421","patch_id":"212857"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL, "k")
	page, found, err := client.PageOfResource(context.Background(), "11421")
	if err != nil || !found || page != "212857" || gotURI != "/v2/moyu/resources/11421" {
		t.Fatalf("resource: %q %v %v %s", page, found, err, gotURI)
	}
	if _, found, err := client.PageOfResource(context.Background(), "1"); err != nil || found {
		t.Fatalf("a resource the other site does not list: %v %v", found, err)
	}
	gotURI = ""
	if _, found, err := client.PageOfResource(context.Background(), "../patches"); err != nil || found || gotURI != "" {
		t.Fatalf("an id that is not a number asks for nothing: %v %v %s", found, err, gotURI)
	}
}

func TestEmptyAndMissingPatches(t *testing.T) {
	for _, body := range []string{`{"items":[]}`, `{"items":[{"id":"p1"}]}`, `{"items":[{"resources":[]}]}`, `{}`} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		entries, err := nextmoe.NewClient(server.Client(), server.URL, "k").Entries(context.Background(), moyu.PageQuery{VNDBID: "v1"})
		server.Close()
		if err != nil || entries == nil || len(entries) != 0 {
			t.Fatalf("%s: got %+v %v", body, entries, err)
		}
	}
}

func TestUpstreamFailures(t *testing.T) {
	for name, handler := range map[string]http.HandlerFunc{
		"rate limited": func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTooManyRequests) },
		"malformed":    func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`<html>`)) },
		"slow": func(w http.ResponseWriter, r *http.Request) {
			select {
			case <-r.Context().Done():
			case <-time.After(time.Second):
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(handler)
			t.Cleanup(server.Close)
			httpClient := server.Client()
			httpClient.Timeout = 100 * time.Millisecond
			client := nextmoe.NewClient(httpClient, server.URL, "k")
			if _, err := client.Entries(context.Background(), moyu.PageQuery{VNDBID: "v1"}); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("entries: expected MOYU_REQUEST_FAILED, got %v", err)
			}
			if _, err := client.Works(context.Background(), []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v1"}}); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("works: expected MOYU_REQUEST_FAILED, got %v", err)
			}
			if _, err := client.Pages(context.Background(), moyu.PageQuery{IDs: []string{"3125"}}); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("pages: expected MOYU_REQUEST_FAILED, got %v", err)
			}
			if _, _, err := client.PageOfResource(context.Background(), "11421"); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("resource: expected MOYU_REQUEST_FAILED, got %v", err)
			}
		})
	}
}
