package httpapi_test

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type uploadThingInput struct {
	RawBody huma.MultipartFormFiles[struct {
		File huma.FormFile `form:"file"`
	}]
}

type uploadedThing struct {
	Size int64 `json:"size"`
}

func multipartBody(t *testing.T, size int) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "a.bin")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(bytes.Repeat([]byte{1}, size))
	_ = writer.Close()
	return &body, writer.FormDataContentType()
}

func TestMaxBodyBytesBoundsMultipartUploads(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	builder := response.NewBuilder(catalog, func() time.Time { return time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC) })
	api := httpapi.New(httpapi.Options{
		Title: "test", Version: "test",
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		Catalog:        catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver([]netip.Prefix{netip.MustParsePrefix("127.0.0.0/8")}),
		Authenticator:  fakeAuthenticator{},
	})
	httpapi.Register(api, httpapi.Route{ID: "thing.upload", Method: http.MethodPut, Path: "/things/upload", MaxBodyBytes: 1024},
		func(ctx context.Context, in *uploadThingInput) (*response.Output[uploadedThing], error) {
			return response.OK(ctx, builder, uploadedThing{Size: in.RawBody.Data().File.Size}), nil
		})

	small, contentType := multipartBody(t, 100)
	req := httptest.NewRequest(http.MethodPut, "/things/upload", small)
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	api.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"size":100`)) {
		t.Fatalf("small upload: %d %s", rec.Code, rec.Body)
	}

	large, contentType := multipartBody(t, 4096)
	req = httptest.NewRequest(http.MethodPut, "/things/upload", large)
	req.Header.Set("Content-Type", contentType)
	rec = httptest.NewRecorder()
	api.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge || !bytes.Contains(rec.Body.Bytes(), []byte(`"code":413`)) {
		t.Fatalf("oversized upload: %d %s", rec.Code, rec.Body)
	}

	chunked, contentType := multipartBody(t, 4096)
	req = httptest.NewRequest(http.MethodPut, "/things/upload", io.MultiReader(chunked))
	req.ContentLength = -1
	req.Header.Set("Content-Type", contentType)
	rec = httptest.NewRecorder()
	api.Handler().ServeHTTP(rec, req)
	if rec.Code < http.StatusBadRequest {
		t.Fatalf("bodies without a length must still be bounded: %d %s", rec.Code, rec.Body)
	}
}
