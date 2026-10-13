package nextmoe_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/nextmoe"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestEntriesByVNDBID(t *testing.T) {
	var gotURI, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI, gotAuth = r.URL.RequestURI(), r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"object":"list","items":[{"object":"patch","id":"p1","resources":[` +
			`{"object":"patch_resource","id":"r1","name":" 汉化补丁 ","type":["manual"],"web_url":"https://www.moyu.moe/resource/r1","updated_at":"2026-07-09T08:00:00Z","extra":{"ignored":true}},` +
			`{"object":"patch_resource","id":7,"web_url":"https://www.moyu.moe/resource/7","updated_at":"2026-07-09T08:00:00Z"}` +
			`]},{"object":"patch","id":"p2","resources":[{"id":"r2","type":["save"],"web_url":"https://www.moyu.moe/resource/r2","updated_at":"2025-09-25T00:00:00+08:00"}]}],"next_cursor":null,"total":2}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL+"/", "nmk_test_key")
	entries, err := client.EntriesByVNDBID(context.Background(), "v4145")
	if err != nil {
		t.Fatal(err)
	}
	if gotURI != "/v2/moyu/patches?include=resources%2Cpublisher&nsfw=true&refs=vndb%3Av4145" || gotAuth != "Bearer nmk_test_key" {
		t.Fatalf("unexpected request %s %s", gotURI, gotAuth)
	}
	if len(entries) != 2 || entries[0].ID != "r1" || entries[0].Name != "汉化补丁" || entries[1].ID != "r2" || entries[1].Kind != moyu.KindSave {
		t.Fatalf("every page's resources are read and one that cannot be read is left out: %+v", entries)
	}
	if !entries[1].Updated.Equal(time.Date(2025, 9, 24, 16, 0, 0, 0, time.UTC)) {
		t.Fatalf("updated: %v", entries[1].Updated)
	}
}

func TestEmptyAndMissingPatches(t *testing.T) {
	for _, body := range []string{`{"items":[]}`, `{"items":[{"id":"p1"}]}`, `{"items":[{"resources":[]}]}`, `{}`} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		entries, err := nextmoe.NewClient(server.Client(), server.URL, "k").EntriesByVNDBID(context.Background(), "v1")
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
			_, err := nextmoe.NewClient(httpClient, server.URL, "k").EntriesByVNDBID(context.Background(), "v1")
			if !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("expected MOYU_REQUEST_FAILED, got %v", err)
			}
		})
	}
}
