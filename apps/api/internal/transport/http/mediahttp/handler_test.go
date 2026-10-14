package mediahttp_test

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/mediahttp"
)

var (
	admin  = actor.Actor{UserID: 1, Role: actor.RoleAdmin, ContentLimit: actor.ContentLimitJustShow}
	member = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
)

type transcoder struct {
	width  int
	height int
}

func (t transcoder) ToWebP(_ context.Context, data []byte, _ media.Bounds) (media.Encoded, error) {
	return media.Encoded{Data: data, ContentType: "image/webp", Extension: ".webp", Width: t.width, Height: t.height}, nil
}

type bucket struct {
	keys []string
}

func (b *bucket) PutBytes(_ context.Context, key string, _ []byte, _ string, _ map[string]string) error {
	b.keys = append(b.keys, key)
	return nil
}

func setup(t *testing.T) (*apitest.Server, *bucket) {
	t.Helper()
	return setupSized(t, 1200, 200)
}

func setupSized(t *testing.T, width, height int) (*apitest.Server, *bucket) {
	t.Helper()
	server := apitest.New(t)
	store := &bucket{}
	mediahttp.NewHandler(media.NewService(transcoder{width: width, height: height}, store, func() string { return "uuid" }), server.Builder).Register(server.API)
	return server, store
}

func upload(t *testing.T, field, contentType string, size int) apitest.Request {
	t.Helper()
	return uploadTo(t, "/uploads/small/ad/banner", field, contentType, size)
}

func uploadTo(t *testing.T, path, field, contentType string, size int) apitest.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", `form-data; name="`+field+`"; filename="image"`)
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(bytes.Repeat([]byte{7}, size)); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return apitest.Request{Method: http.MethodPut, Path: path, Body: body.String(), Header: map[string]string{"Content-Type": writer.FormDataContentType()}}
}

func as(req apitest.Request, who actor.Actor) apitest.Request {
	req.As = &who
	return req
}

func TestAdBannerUploadIsForAdmins(t *testing.T) {
	server, store := setup(t)
	server.Expect(server.Do(upload(t, "file", "image/webp", 10)), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(as(upload(t, "file", "image/webp", 10), member)), http.StatusForbidden, http.StatusForbidden)
	resp := server.Do(as(upload(t, "file", "image/webp", 10), admin))
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"key":"spotlight/banner/uuid.webp"}` || len(store.keys) != 1 || store.keys[0] != "spotlight/banner/uuid.webp" {
		t.Fatalf("ad banner %s stored %v", resp.Data, store.keys)
	}
}

func TestEachAdImageMustHaveItsShape(t *testing.T) {
	cases := []struct {
		path          string
		width, height int
		key           string
		code          int
	}{
		{path: "/uploads/small/ad/banner", width: 1920, height: 320, key: "spotlight/banner/uuid.webp"},
		{path: "/uploads/small/ad/banner", width: 1200, height: 260, code: 490104},
		{path: "/uploads/small/ad/banner", width: 900, height: 150, code: 490104},
		{path: "/uploads/small/ad/side-image", width: 500, height: 193, key: "spotlight/side/uuid.webp"},
		{path: "/uploads/small/ad/side-image", width: 200, height: 60, code: 490105},
		{path: "/uploads/small/ad/side-icon", width: 128, height: 128, key: "spotlight/icon/uuid.webp"},
		{path: "/uploads/small/ad/side-icon", width: 128, height: 96, code: 490106},
	}
	for _, c := range cases {
		server, store := setupSized(t, c.width, c.height)
		resp := server.Do(as(uploadTo(t, c.path, "file", "image/png", 10), admin))
		if c.code != 0 {
			server.Expect(resp, http.StatusBadRequest, c.code)
			if len(store.keys) != 0 {
				t.Fatalf("%s %dx%d must not be stored: %v", c.path, c.width, c.height, store.keys)
			}
			continue
		}
		server.Expect(resp, http.StatusOK, 0)
		if len(store.keys) != 1 || store.keys[0] != c.key {
			t.Fatalf("%s %dx%d stored %v", c.path, c.width, c.height, store.keys)
		}
	}
}

func TestAdImageUploadRejectsBadFiles(t *testing.T) {
	server, store := setup(t)
	server.Expect(server.Do(as(upload(t, "other", "image/webp", 10), admin)), http.StatusBadRequest, 490102)
	server.Expect(server.Do(as(upload(t, "file", "image/gif", 10), admin)), http.StatusUnsupportedMediaType, 490103)
	server.Expect(server.Do(as(upload(t, "file", "image/webp", media.AdImageMaxBytes+1), admin)), http.StatusRequestEntityTooLarge, http.StatusRequestEntityTooLarge)
	if len(store.keys) != 0 {
		t.Fatalf("rejected uploads must not be stored: %v", store.keys)
	}
}

func TestFriendLinkLogoUploadIsForAdmins(t *testing.T) {
	server, store := setup(t)
	logo := func() apitest.Request { return uploadTo(t, "/uploads/small/friend-link/logo", "file", "image/png", 10) }
	server.Expect(server.Do(as(logo(), member)), http.StatusForbidden, http.StatusForbidden)
	resp := server.Do(as(logo(), admin))
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"key":"friend-link/logo/uuid.webp"}` || len(store.keys) != 1 {
		t.Fatalf("friend link logo %s stored %v", resp.Data, store.keys)
	}
}
