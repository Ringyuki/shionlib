package uploadhttp_test

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
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
	spool  *uploadtest.MemorySpool
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := uploadtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	quotas := uploadtest.NewMemoryQuotaRepository()
	tx := &txtest.Immediate{}
	settings := settingtest.Source{}
	settingtest.Set(settings, upload.ChunkSize, 4)
	settingtest.Set(settings, upload.ChunkLimit, 8)
	settingtest.Set(settings, upload.MaxChunks, 100)
	settingtest.Set(settings, upload.MaxFileSize, 1000)
	settingtest.Set(settings, upload.NewUploaderQuota, 100)
	settingtest.Set(settings, upload.InFlightLimit, 50)
	settingtest.Set(settings, upload.SpoolReserve, 10)
	spool := uploadtest.NewMemorySpool()
	quota := upload.NewQuotaService(quotas, settings, func() time.Time { return apitest.Now })
	service := upload.NewService(repo, quota, spool, uploadtest.NewMemoryHolds(), tx, settings, func() time.Time { return apitest.Now })
	uploadhttp.NewHandler(service, quota, server.Builder).Register(server.API)
	return env{server: server, repo: repo, quotas: quotas, spool: spool}
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
	e.quotas.SeedUsage(member.UserID, 30, 6)
	content := "0123456789"

	quota := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/quota", As: &member})
	e.server.Expect(quota, http.StatusOK, 0)
	if string(quota.Data) != `{"tier":"new","approved":0,"trusted":false,"frozen_until":null,"stored":30,"stored_limit":100,"in_flight":6,"in_flight_limit":50,"max_file_size":1000}` {
		t.Fatalf("quota %s", quota.Data)
	}

	init := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "game.7z", "total_size": 10}})
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
	if string(ongoing.Data) != `[{"upload_session_id":1,"status":"UPLOADING","file_name":"game.7z","total_size":10,"chunk_size":4,"uploaded_chunks":[2,0,1],"total_chunks":3,"expires_at":"2026-10-04T01:02:03.000Z","held_elsewhere":false}]` {
		t.Fatalf("ongoing %s", ongoing.Data)
	}
	status := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/1/status", As: &member})
	e.server.Expect(status, http.StatusOK, 0)
	if !strings.Contains(string(status.Data), `"status":"UPLOADING","uploaded_chunks":[0,1,2]`) {
		t.Fatalf("status %s", status.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Body: map[string]any{"file_sha256": "not-hex"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Body: map[string]any{"file_sha256": uploadtest.Digest([]byte("other"))}}), http.StatusConflict, 480110)
	complete := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Body: map[string]any{"file_sha256": uploadtest.Digest([]byte(content))}})
	e.server.Expect(complete, http.StatusOK, 0)
	if string(complete.Data) != `{"ok":true}` {
		t.Fatalf("complete %s", complete.Data)
	}
	after := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/ongoing", As: &member})
	if !strings.Contains(string(after.Data), `"upload_session_id":1,"status":"COMPLETED"`) {
		t.Fatalf("finished uploads not yet in a resource stay listed: %s", after.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Body: map[string]any{"file_sha256": uploadtest.Digest([]byte(content))}}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member}), http.StatusConflict, 480105)
}

func TestAbortReturnsEmptyEnvelope(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "a", "total_size": 4}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &outsider}), http.StatusForbidden, 480113)
	resp := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("abort omits data: %s", resp.Body)
	}
}

func TestInitErrorsAndValidation(t *testing.T) {
	e := setup(t)
	path := "/uploads/large/init"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: map[string]any{"file_name": "a", "total_size": 4}}), http.StatusUnauthorized, 200101)
	e.quotas.SeedUsage(member.UserID, 97, 0)
	exceeded := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4}})
	e.server.Expect(exceeded, http.StatusConflict, 500102)
	if !strings.Contains(exceeded.Message, "额度") && !strings.Contains(strings.ToLower(exceeded.Message), "quota") {
		t.Fatalf("quota errors mention the quota: %q", exceeded.Message)
	}
	e.quotas.SeedUsage(member.UserID, 0, 48)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4}}), http.StatusConflict, 500105)
	e.quotas.SeedUsage(member.UserID, 0, 0)
	e.spool.Space = 13
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4}}), http.StatusServiceUnavailable, 500106)
	e.spool.Space = 14
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 4}}), http.StatusCreated, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 2, "chunk_size": 9}}), http.StatusBadRequest, 480116)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "a", "total_size": 2, "chunk_size": 0}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: map[string]any{"file_name": "", "total_size": 2}}), http.StatusUnprocessableEntity, 100101)
}

func TestChunkRouteErrors(t *testing.T) {
	e := setup(t)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Body: map[string]any{"file_name": "a", "total_size": 6}}), http.StatusCreated, 0)

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

func TestASessionHeldByOneClientRefusesTheOthers(t *testing.T) {
	e := setup(t)
	content := "0123456789"
	phone := map[string]string{"X-Upload-Client": "phone-0001"}
	laptop := map[string]string{"X-Upload-Client": "laptop-0001"}
	chunk := func(index int, client string) apitest.Request {
		start := index * 4
		part := content[start:min(start+4, len(content))]
		request := chunkRequest("1", strconv.Itoa(index), part, uploadtest.Digest([]byte(part)), &member)
		if client != "" {
			request.Header["X-Upload-Client"] = client
		}
		return request
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/uploads/large/init", As: &member, Header: phone, Body: map[string]any{"file_name": "game.7z", "total_size": 10}}), http.StatusCreated, 0)

	e.server.Expect(e.server.Do(chunk(0, "laptop-0001")), http.StatusConflict, 480117)
	e.server.Expect(e.server.Do(chunk(0, "phone-0001")), http.StatusOK, 0)
	e.server.Expect(e.server.Do(chunk(1, "laptop-0001")), http.StatusConflict, 480117)
	e.server.Expect(e.server.Do(chunk(1, "")), http.StatusConflict, 480117)

	theirs := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/ongoing", As: &member, Header: laptop})
	e.server.Expect(theirs, http.StatusOK, 0)
	if !strings.Contains(string(theirs.Data), `"held_elsewhere":true`) {
		t.Fatalf("another client sees the session as held elsewhere: %s", theirs.Data)
	}
	mine := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/uploads/large/ongoing", As: &member, Header: phone})
	if !strings.Contains(string(mine.Data), `"held_elsewhere":false`) {
		t.Fatalf("the holder does not: %s", mine.Data)
	}

	path := "/uploads/large/hold"
	body := map[string]any{"upload_session_ids": []int{1, 99}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: body, Header: phone}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: body}), http.StatusUnprocessableEntity, 100101)
	refused := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: body, Header: laptop})
	e.server.Expect(refused, http.StatusCreated, 0)
	if string(refused.Data) != `{"held":[],"elsewhere":[1],"ttl_seconds":120}` {
		t.Fatalf("holding from another client: %s", refused.Data)
	}
	renewed := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &member, Body: body, Header: phone})
	if string(renewed.Data) != `{"held":[1],"elsewhere":[],"ttl_seconds":120}` {
		t.Fatalf("renewing from the holder, sessions that are gone left out: %s", renewed.Data)
	}

	e.server.Expect(e.server.Do(chunk(1, "phone-0001")), http.StatusOK, 0)
	e.server.Expect(e.server.Do(chunk(2, "phone-0001")), http.StatusOK, 0)
	digest := map[string]any{"file_sha256": uploadtest.Digest([]byte(content))}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Header: laptop, Body: digest}), http.StatusConflict, 480117)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/uploads/large/1/complete", As: &member, Header: phone, Body: digest}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member, Header: laptop}), http.StatusConflict, 480117)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/uploads/large/1", As: &member, Header: phone}), http.StatusOK, 0)
}
