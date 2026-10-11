package objectstore_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

func previewStore(t *testing.T, handler http.HandlerFunc) *objectstore.PreviewStore {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return objectstore.NewPreviewStore(objectstore.New(objectstore.Options{Bucket: "files", Endpoint: srv.URL, AccessKeyID: "key", SecretAccessKey: "secret", PathStyle: true, HTTPClient: httpclient.New(httpclient.Options{Timeout: 5 * time.Second})}))
}

func TestPreviewStoreReadsAnObjectItStored(t *testing.T) {
	objects := map[string]string{}
	store := previewStore(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			objects[r.URL.Path] = string(body)
		case http.MethodGet:
			content, found := objects[r.URL.Path]
			if !found {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`<Error><Code>NoSuchKey</Code></Error>`))
				return
			}
			_, _ = w.Write([]byte(content))
		}
	})
	ctx := context.Background()
	if err := store.PutBytes(ctx, "inspections/1/2", []byte("readme"), "application/octet-stream", nil); err != nil {
		t.Fatal(err)
	}
	got, err := store.GetBytes(ctx, "inspections/1/2", 6)
	if err != nil || string(got) != "readme" {
		t.Fatalf("get: %q %v", got, err)
	}
	if _, err := store.GetBytes(ctx, "inspections/1/2", 5); err == nil {
		t.Fatal("an object over the limit must be refused")
	}
	if _, err := store.GetBytes(ctx, "inspections/1/3", 6); !errors.Is(err, inspection.ErrNoPreview) {
		t.Fatalf("a missing object: %v", err)
	}
}

func TestPreviewStoreReportsFailures(t *testing.T) {
	store := previewStore(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`<Error><Code>AccessDenied</Code></Error>`))
	})
	if _, err := store.GetBytes(context.Background(), "k", 10); err == nil || errors.Is(err, inspection.ErrNoPreview) {
		t.Fatalf("a refused request is a failure: %v", err)
	}
	if err := store.Delete(context.Background(), "k"); err == nil {
		t.Fatal("a refused delete is a failure")
	}
	unconfigured := objectstore.NewPreviewStore(objectstore.New(objectstore.Options{}))
	if _, err := unconfigured.GetBytes(context.Background(), "k", 10); err == nil {
		t.Fatal("an unconfigured bucket must fail")
	}
}
