package uploadhttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/uploadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	member   = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	outsider = actor.Actor{UserID: 2, Role: actor.RoleUser}
)

type env struct {
	server *apitest.Server
	repo   *uploadtest.MemoryRepository
	quotas *uploadtest.MemoryQuotaRepository
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := uploadtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	quotas := uploadtest.NewMemoryQuotaRepository()
	tx := &txtest.Immediate{}
	quota := upload.NewQuotaService(quotas, tx, upload.QuotaPolicy{}, func() time.Time { return apitest.Now })
	service := upload.NewService(repo, quota, uploadtest.NewMemorySpool(), tx, upload.Options{ChunkSize: 4, MaxChunks: 100, MaxFileSize: 1000, TransferLimit: 8, SessionTTL: 24 * time.Hour}, func() time.Time { return apitest.Now })
	uploadhttp.NewHandler(service, quota, server.Builder, ratelimit.Policy{Name: "upload_chunk", Limit: 10000, Window: time.Minute}).Register(server.API)
	return env{server: server, repo: repo, quotas: quotas}
}

func chunkRequest(id, index string, body string, digest string, who *actor.Actor) apitest.Request {
	headers := map[string]string{"Content-Type": "application/octet-stream"}
	if digest != "" {
		headers["chunk-sha256"] = digest
	}
	return apitest.Request{Method: http.MethodPut, Path: "/uploads/large/" + id + "/chunks/" + index, Body: body, As: who, Header: headers}
}

func TestChunkedUploadFlow(t *testing.T) {
	e := setup(t)
	e.quotas.SeedQuota(upload.Quota{UserID: member.UserID, Size: 100})
	content := "0123456789"

	quota := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/quota", As: &member})
	e.server.Expect(quota, http.StatusOK, 0)
	if string(quota.Data) != `{"size":100,"used":0}` {
		t.Fatalf("quota %s", quota.Data)
	}

	init := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "game.7z", "total_size": 10, "file_sha256": uploadtest.Digest([]byte(content))}})
	e.server.Expect(init, http.StatusCreated, 0)
	if string(init.Data) != `{"upload_session_id":1,"chunk_size":4,"total_chunks":3,"expires_at":"2026-10-04T01:02:03.000Z"}` {
		t.Fatalf("init %s", init.Data)
	}

	for _, index := range []int{2, 0, 1} {
		start := index * 4
		part := content[start:min(start+4, len(content))]
		resp := e.server.Do(chunkRequest("1", strconv.Itoa(index), part, uploadtest.Digest([]byte(part)), &member))
		e.server.Expect(resp, http.StatusOK, 0)
		if string(resp.Data) != `{"ok":true,"chunk_index":`+strconv.Itoa(index)+`}` {
			t.Fatalf("chunk %d: %s", index, resp.Data)
		}
	}
	ongoing := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/ongoing", As: &member})
	e.server.Expect(ongoing, http.StatusOK, 0)
	if string(ongoing.Data) != `[{"upload_session_id":1,"file_name":"game.7z","file_sha256":"`+uploadtest.Digest([]byte(content))+`","total_size":10,"chunk_size":4,"uploaded_chunks":[2,0,1],"total_chunks":3,"expires_at":"2026-10-04T01:02:03.000Z"}]` {
		t.Fatalf("ongoing %s", ongoing.Data)
	}
	status := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/1/status", As: &member})
	e.server.Expect(status, http.StatusOK, 0)
	if !strings.Contains(string(status.Data), `"status":"UPLOADING","uploaded_chunks":[0,1,2]`) {
		t.Fatalf("status %s", status.Data)
	}
	complete := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member})
	e.server.Expect(complete, http.StatusOK, 0)
	if string(complete.Data) != `{"ok":true}` {
		t.Fatalf("complete %s", complete.Data)
	}
	after := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/ongoing", As: &member})
	if string(after.Data) != `[]` {
		t.Fatalf("completed sessions are not ongoing: %s", after.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member}), http.StatusConflict, 480105)
}

func TestAbortReturnsEmptyEnvelope(t *testing.T) {
	e := setup(t)
	e.quotas.SeedQuota(upload.Quota{UserID: member.UserID, Size: 100})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "a", "total_size": 4, "file_sha256": "x"}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &outsider}), http.StatusForbidden, 480113)
	resp := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("abort omits data: %s", resp.Body)
	}
	quota := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/quota", As: &member})
	if string(quota.Data) != `{"size":100,"used":0}` {
		t.Fatalf("abort refunds the quota: %s", quota.Data)
	}
}

func TestInitErrorsAndValidation(t *testing.T) {
	e := setup(t)
	path := "/uploads/large/init"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: map[string]any{"file_name": "a", "total_size": 4, "file_sha256": "x"}}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4, "file_sha256": "x"}}), http.StatusNotFound, 500101)
	e.quotas.SeedQuota(upload.Quota{UserID: member.UserID, Size: 3})
	exceeded := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4, "file_sha256": "x"}})
	e.server.Expect(exceeded, http.StatusConflict, 500102)
	if !strings.Contains(exceeded.Message, "额度") && !strings.Contains(strings.ToLower(exceeded.Message), "quota") {
		t.Fatalf("quota errors mention the quota: %q", exceeded.Message)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 2, "chunk_size": 9, "file_sha256": "x"}}), http.StatusBadRequest, 480116)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 2, "chunk_size": 0, "file_sha256": "x"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "", "total_size": 2, "file_sha256": "x"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 2}}), http.StatusUnprocessableEntity, 100101)
}

func TestChunkRouteErrors(t *testing.T) {
	e := setup(t)
	e.quotas.SeedQuota(upload.Quota{UserID: member.UserID, Size: 100})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "a", "total_size": 6, "file_sha256": "x"}}), http.StatusCreated, 0)

	e.server.Expect(e.server.Do(chunkRequest("1", "0", "0123", uploadtest.Digest([]byte("0123")), nil)), http.StatusUnauthorized, 200101)
	invalid := e.server.Do(chunkRequest("abc", "0", "0123", "x", &member))
	e.server.Expect(invalid, http.StatusUnprocessableEntity, 100101)
	if !strings.Contains(string(invalid.Data), `"field":"id"`) {
		t.Fatalf("invalid path params are reported per field: %s", invalid.Data)
	}
	e.server.Expect(e.server.Do(chunkRequest("1", "0", "012345678", "x", &member)), http.StatusRequestEntityTooLarge, 413)
	e.server.Expect(e.server.Do(chunkRequest("99", "0", "0123", "x", &member)), http.StatusNotFound, 480104)
	e.server.Expect(e.server.Do(chunkRequest("1", "-1", "0123", "x", &member)), http.StatusBadRequest, 480111)
	e.server.Expect(e.server.Do(chunkRequest("1", "0", "0123", "x", &outsider)), http.StatusForbidden, 480113)
	length := e.server.Do(chunkRequest("1", "1", "0123", "x", &member))
	e.server.Expect(length, http.StatusBadRequest, 480106)
	if !strings.Contains(length.Message, "2") || !strings.Contains(length.Message, "4") {
		t.Fatalf("length message interpolates expected and actual: %q", length.Message)
	}
	e.server.Expect(e.server.Do(chunkRequest("1", "0", "0123", "nope", &member)), http.StatusConflict, 480108)
	e.server.Expect(e.server.Do(chunkRequest("1", "0", "0123", uploadtest.Digest([]byte("0123")), &member)), http.StatusOK, 0)
	e.server.Expect(e.server.Do(chunkRequest("1", "0", "0123", "nope", &member)), http.StatusConflict, 480107)
}

func TestUploadRoutesRequireLogin(t *testing.T) {
	e := setup(t)
	for _, req := range []apitest.Request{
		{Method: http.MethodGet, Path: "/uploads/large/ongoing"},
		{Method: http.MethodGet, Path: "/uploads/large/1/status"},
		{Method: http.MethodPatch, Path: "/uploads/large/1/complete"},
		{Method: http.MethodDelete, Path: "/uploads/large/1"},
		{Method: http.MethodGet, Path: "/uploads/quota"},
	} {
		e.server.Expect(e.server.Do(req), http.StatusUnauthorized, 200101)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/abc/status", As: &member}), http.StatusUnprocessableEntity, 100101)
}
