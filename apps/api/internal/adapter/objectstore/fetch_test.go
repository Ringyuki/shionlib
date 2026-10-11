package objectstore_test

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.Objects = (*objectstore.Store)(nil)

func fetchingStore(t *testing.T, handler http.HandlerFunc) *objectstore.Store {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return objectstore.New(objectstore.Options{Bucket: "files", Endpoint: srv.URL, AccessKeyID: "key", SecretAccessKey: "secret", PathStyle: true, HTTPClient: httpclient.New(httpclient.Options{Timeout: 5 * time.Second})})
}

func TestFetchWritesTheObjectToTheGivenPath(t *testing.T) {
	content := bytes.Repeat([]byte("archive"), 50_000)
	var asked string
	store := fetchingStore(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.Method + " " + r.URL.Path
		_, _ = w.Write(content)
	})
	target := filepath.Join(t.TempDir(), "stored", "12")
	if err := store.Fetch(context.Background(), "games/7/12/game.7z", target); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(target)
	if err != nil || !bytes.Equal(got, content) || asked != "GET /files/games/7/12/game.7z" {
		t.Fatalf("fetched %d bytes with %q: %v", len(got), asked, err)
	}
}

func TestFetchTellsAMissingObjectFromAFailure(t *testing.T) {
	missing := fetchingStore(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`<Error><Code>NoSuchKey</Code></Error>`))
	})
	target := filepath.Join(t.TempDir(), "12")
	if err := missing.Fetch(context.Background(), "games/gone.7z", target); !errors.Is(err, scan.ErrObjectMissing) {
		t.Fatalf("a missing object: %v", err)
	}
	if _, err := os.Stat(target); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("nothing is written for a missing object: %v", err)
	}
	refused := fetchingStore(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`<Error><Code>AccessDenied</Code></Error>`))
	})
	if err := refused.Fetch(context.Background(), "games/x.7z", target); err == nil || errors.Is(err, scan.ErrObjectMissing) {
		t.Fatalf("a refused request is a failure: %v", err)
	}
	if err := objectstore.New(objectstore.Options{}).Fetch(context.Background(), "k", target); err == nil {
		t.Fatal("an unconfigured bucket must fail")
	}
}
