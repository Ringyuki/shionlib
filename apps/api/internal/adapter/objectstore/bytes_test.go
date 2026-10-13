package objectstore_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
)

func TestPutBytesUploadsWithMetadata(t *testing.T) {
	var (
		method, path, contentType, owner, authorization string
		body                                            []byte
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method, path = r.Method, r.URL.Path
		contentType, owner, authorization = r.Header.Get("Content-Type"), r.Header.Get("X-Amz-Meta-User_id"), r.Header.Get("Authorization")
		body, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	store := objectstore.New(objectstore.Options{Bucket: "images", Endpoint: srv.URL, AccessKeyID: "key", SecretAccessKey: "secret", PathStyle: true, HTTPClient: httpclient.New(httpclient.Options{Timeout: 5 * time.Second})})
	if err := store.PutBytes(context.Background(), "user/1/avatar/a.webp", []byte("webp"), "image/webp", map[string]string{"user_id": "1"}); err != nil {
		t.Fatal(err)
	}
	if method != http.MethodPut || path != "/images/user/1/avatar/a.webp" || contentType != "image/webp" || owner != "1" || string(body) != "webp" || authorization == "" {
		t.Fatalf("unexpected request %s %s %s %s %q %q", method, path, contentType, owner, body, authorization)
	}
}

func TestPutBytesReportsFailures(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`<Error><Code>AccessDenied</Code></Error>`))
	}))
	defer srv.Close()
	store := objectstore.New(objectstore.Options{Bucket: "images", Endpoint: srv.URL, PathStyle: true, HTTPClient: httpclient.New(httpclient.Options{Timeout: 5 * time.Second})})
	if err := store.PutBytes(context.Background(), "k", []byte("x"), "image/webp", nil); err == nil {
		t.Fatal("expected a failure")
	}
	if err := objectstore.New(objectstore.Options{}).PutBytes(context.Background(), "k", nil, "", nil); err == nil {
		t.Fatal("an unconfigured bucket must fail")
	}
}
