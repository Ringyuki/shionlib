package objectstore_test

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var (
	_ scan.Objects        = (*objectstore.Store)(nil)
	_ composition.Objects = (*objectstore.Store)(nil)
)

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

func TestDownloadTellsHowMuchHasArrived(t *testing.T) {
	content := bytes.Repeat([]byte("archive"), 50_000)
	store := fetchingStore(t, func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(content) })
	target := filepath.Join(t.TempDir(), "base", "game.7z")
	var seen []int64
	if err := store.Download(context.Background(), "games/7/12/game.7z", target, func(done int64) { seen = append(seen, done) }); err != nil {
		t.Fatal(err)
	}
	if len(seen) == 0 || seen[len(seen)-1] != int64(len(content)) {
		t.Fatalf("the last report is the whole object: %v", seen)
	}
	for i := 1; i < len(seen); i++ {
		if seen[i] <= seen[i-1] {
			t.Fatalf("reports only grow: %v", seen)
		}
	}
	if got, err := os.ReadFile(target); err != nil || !bytes.Equal(got, content) {
		t.Fatalf("downloaded %d bytes: %v", len(got), err)
	}
}

func rangedStore(t *testing.T, content []byte, handle func(w http.ResponseWriter, r *http.Request) bool) (*objectstore.Store, *[]string) {
	t.Helper()
	var mu sync.Mutex
	asked := []string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		asked = append(asked, r.Header.Get("Range"))
		mu.Unlock()
		if handle != nil && handle(w, r) {
			return
		}
		http.ServeContent(w, r, "game.7z", time.Time{}, bytes.NewReader(content))
	}))
	t.Cleanup(srv.Close)
	store := objectstore.New(objectstore.Options{
		Bucket: "files", Endpoint: srv.URL, AccessKeyID: "key", SecretAccessKey: "secret", PathStyle: true,
		HTTPClient:       httpclient.New(httpclient.Options{Timeout: 5 * time.Second}),
		DownloadPartSize: 64 << 10, DownloadConcurrency: 4,
	})
	return store, &asked
}

func TestDownloadReadsALargeObjectInRangesAtOnce(t *testing.T) {
	content := make([]byte, 350_000)
	for i := range content {
		content[i] = byte(i * 7)
	}
	store, asked := rangedStore(t, content, nil)
	target := filepath.Join(t.TempDir(), "base", "game.7z")
	var seen []int64
	if err := store.Download(context.Background(), "games/7/12/game.7z", target, func(done int64) { seen = append(seen, done) }); err != nil {
		t.Fatal(err)
	}
	if got, err := os.ReadFile(target); err != nil || !bytes.Equal(got, content) {
		t.Fatalf("downloaded %d bytes: %v", len(got), err)
	}
	slices.Sort(*asked)
	want := []string{"bytes=0-65535", "bytes=131072-196607", "bytes=196608-262143", "bytes=262144-327679", "bytes=327680-349999", "bytes=65536-131071"}
	if !slices.Equal(*asked, want) {
		t.Fatalf("ranges asked: %v", *asked)
	}
	for i := 1; i < len(seen); i++ {
		if seen[i] <= seen[i-1] {
			t.Fatalf("reports only grow: %v", seen)
		}
	}
	if seen[len(seen)-1] != int64(len(content)) {
		t.Fatalf("the last report is the whole object: %d", seen[len(seen)-1])
	}
}

func TestDownloadTriesAFailedRangeAgain(t *testing.T) {
	content := bytes.Repeat([]byte("range"), 40_000)
	var failed atomic.Bool
	store, _ := rangedStore(t, content, func(w http.ResponseWriter, r *http.Request) bool {
		if r.Header.Get("Range") == "bytes=65536-131071" && failed.CompareAndSwap(false, true) {
			w.WriteHeader(http.StatusServiceUnavailable)
			return true
		}
		return false
	})
	target := filepath.Join(t.TempDir(), "game.7z")
	if err := store.Fetch(context.Background(), "games/7/12/game.7z", target); err != nil {
		t.Fatal(err)
	}
	if got, err := os.ReadFile(target); err != nil || !bytes.Equal(got, content) || !failed.Load() {
		t.Fatalf("downloaded %d bytes after a refused range: %v", len(got), err)
	}
}

func TestDownloadTakesAnEmptyObject(t *testing.T) {
	store, _ := rangedStore(t, []byte{}, nil)
	target := filepath.Join(t.TempDir(), "empty")
	if err := store.Fetch(context.Background(), "games/empty", target); err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(target); err != nil || info.Size() != 0 {
		t.Fatalf("an empty object becomes an empty file: %v", err)
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
