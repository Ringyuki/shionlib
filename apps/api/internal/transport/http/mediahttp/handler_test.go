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

type transcoder struct{}

func (transcoder) ToWebP(_ context.Context, data []byte, _ media.Bounds) (media.Encoded, error) {
	return media.Encoded{Data: data, ContentType: "image/webp", Extension: ".webp"}, nil
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
	server := apitest.New(t)
	store := &bucket{}
	mediahttp.NewHandler(media.NewService(transcoder{}, store, func() string { return "uuid" }), server.Builder).Register(server.API)
	return server, store
}

func upload(t *testing.T, field, contentType string, size int) apitest.Request {
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
	return apitest.Request{Method: http.MethodPut, Path: "/uploads/small/ad/image", Body: body.String(), Header: map[string]string{"Content-Type": writer.FormDataContentType()}}
}

func as(req apitest.Request, who actor.Actor) apitest.Request {
	req.As = &who
	return req
}

func TestAdImageUploadIsForAdmins(t *testing.T) {
	server, store := setup(t)
	server.Expect(server.Do(upload(t, "file", "image/webp", 10)), http.StatusUnauthorized, 200101)
	server.Expect(server.Do(as(upload(t, "file", "image/webp", 10), member)), http.StatusForbidden, http.StatusForbidden)
	resp := server.Do(as(upload(t, "file", "image/webp", 10), admin))
	server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"key":"ad/image/uuid.webp"}` || len(store.keys) != 1 || store.keys[0] != "ad/image/uuid.webp" {
		t.Fatalf("ad image %s stored %v", resp.Data, store.keys)
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
