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

func TestResourcesByVNDBID(t *testing.T) {
	var gotURI, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotURI, gotAuth = r.URL.RequestURI(), r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"object":"list","items":[{"object":"patch","id":"p1","resources":[{"object":"patch_resource","id":"r1","extra":{"kept":true}}]}],"next_cursor":null,"total":1}`))
	}))
	t.Cleanup(server.Close)
	client := nextmoe.NewClient(server.Client(), server.URL+"/", "nmk_test_key")
	lookup, err := client.ResourcesByVNDBID(context.Background(), "v4145")
	if err != nil {
		t.Fatal(err)
	}
	if gotURI != "/v2/moyu/patches?include=resources%2Cpublisher&nsfw=true&refs=vndb%3Av4145" || gotAuth != "Bearer nmk_test_key" {
		t.Fatalf("unexpected request %s %s", gotURI, gotAuth)
	}
	if !lookup.Found || len(lookup.Resources) != 1 || string(lookup.Resources[0]) != `{"object":"patch_resource","id":"r1","extra":{"kept":true}}` {
		t.Fatalf("resources are forwarded verbatim: %+v", lookup)
	}
}

func TestEmptyAndMissingPatches(t *testing.T) {
	for body, want := range map[string]moyu.Lookup{
		`{"items":[]}`:                 {},
		`{"items":[{"id":"p1"}]}`:      {Found: true, Resources: []moyu.Resource{}},
		`{"items":[{"resources":[]}]}`: {Found: true, Resources: []moyu.Resource{}},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		lookup, err := nextmoe.NewClient(server.Client(), server.URL, "k").ResourcesByVNDBID(context.Background(), "v1")
		server.Close()
		if err != nil || lookup.Found != want.Found || len(lookup.Resources) != len(want.Resources) || (want.Found && lookup.Resources == nil) {
			t.Fatalf("%s: got %+v %v", body, lookup, err)
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
			_, err := nextmoe.NewClient(httpClient, server.URL, "k").ResourcesByVNDBID(context.Background(), "v1")
			if !errors.Is(err, moyu.ErrRequestFailed) {
				t.Fatalf("expected MOYU_REQUEST_FAILED, got %v", err)
			}
		})
	}
}
