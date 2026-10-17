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
	entries, err := client.Entries(context.Background(), "v4145", []string{"61311", "212857"})
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
	if _, err := client.Entries(context.Background(), "", []string{"212857"}); err != nil || gotURI != "/v2/moyu/patches?include=resources%2Cpublisher&nsfw=true&refs=catalog%3A212857" {
		t.Fatalf("a page whose game is not on vndb is found by its work: %s %v", gotURI, err)
	}
	gotURI = ""
	none, err := client.Entries(context.Background(), " ", []string{"", "1,2"})
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

func TestTitled(t *testing.T) {
	var gotURI string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI = r.URL.RequestURI()
		_, _ = w.Write([]byte(`{"object":"list","items":[` +
			`{"object":"work","id":"212857","display_name":" プレミアムアーカイブス むとうけいじ ","latin":null,"localized":{"ja":{"value":"プレミアムアーカイブス むとうけいじ","is_machine":false},"zh-Hans":{"value":"高级典藏 武藤启治","is_machine":true}},"release_date":"2016-12-22"},` +
			`{"object":"work","id":"7","display_name":"Premium","latin":"Puremiamu","localized":{},"release_date":"2016"},` +
			`{"object":"work","id":"x","display_name":"ignored"}],"next_cursor":null}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL, "k")
	works, err := client.Titled(context.Background(), " プレミアムアーカイブス むとうけいじ ")
	if err != nil || len(works) != 2 {
		t.Fatalf("works: %+v %v", works, err)
	}
	if gotURI != "/v2/catalog/works?include=titles&limit=10&nsfw=true&q=%E3%83%97%E3%83%AC%E3%83%9F%E3%82%A2%E3%83%A0%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%E3%82%B9+%E3%82%80%E3%81%A8%E3%81%86%E3%81%91%E3%81%84%E3%81%98" {
		t.Fatalf("unexpected request %s", gotURI)
	}
	archives, other := works[0], works[1]
	if archives.ID != "212857" || !slices.Equal(archives.Titles, []string{"プレミアムアーカイブス むとうけいじ", "プレミアムアーカイブス むとうけいじ"}) || archives.Released == nil || archives.Released.Format(time.DateOnly) != "2016-12-22" {
		t.Fatalf("a title a machine translated is not a title of the work: %+v", archives)
	}
	if !slices.Equal(other.Titles, []string{"Premium", "Puremiamu"}) || other.Released == nil || other.Released.Year() != 2016 {
		t.Fatalf("a date known only to the year: %+v", other)
	}
	gotURI = ""
	if none, err := client.Titled(context.Background(), " "); err != nil || none == nil || len(none) != 0 || gotURI != "" {
		t.Fatalf("no title asks for nothing: %v %v %s", none, err, gotURI)
	}
}

func TestEmptyAndMissingPatches(t *testing.T) {
	for _, body := range []string{`{"items":[]}`, `{"items":[{"id":"p1"}]}`, `{"items":[{"resources":[]}]}`, `{}`} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		entries, err := nextmoe.NewClient(server.Client(), server.URL, "k").Entries(context.Background(), "v1", nil)
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
			if _, err := client.Entries(context.Background(), "v1", nil); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("entries: expected MOYU_REQUEST_FAILED, got %v", err)
			}
			if _, err := client.Works(context.Background(), []moyu.Anchor{{Source: moyu.SourceVNDB, ID: "v1"}}); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("works: expected MOYU_REQUEST_FAILED, got %v", err)
			}
			if _, err := client.Titled(context.Background(), "脅迫"); !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("titled: expected MOYU_REQUEST_FAILED, got %v", err)
			}
		})
	}
}
