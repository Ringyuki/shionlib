package uploadhttp_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/uploadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var admin = actor.Actor{UserID: 9, Role: actor.RoleAdmin}

type adminStore struct {
	filter  download.UploadFilter
	page    download.Page
	entries []download.Upload
	detail  download.UploadDetail
}

func (s *adminStore) Uploads(_ context.Context, filter download.UploadFilter, page download.Page) ([]download.Upload, int, error) {
	s.filter, s.page = filter, page
	return s.entries, 41, nil
}

func (s *adminStore) SessionUpload(_ context.Context, id int) (download.UploadDetail, error) {
	if s.detail.Kind != download.UploadSession || s.detail.ID != id {
		return download.UploadDetail{}, upload.ErrSessionNotFound
	}
	return s.detail, nil
}

func (s *adminStore) AttemptUpload(_ context.Context, id int) (download.UploadDetail, error) {
	return download.UploadDetail{}, upload.ErrFailureNotFound
}

type adminEnv struct {
	server *apitest.Server
	store  *adminStore
	repo   *uploadtest.MemoryRepository
}

func setupAdmin(t *testing.T) adminEnv {
	t.Helper()
	server := apitest.New(t)
	repo := uploadtest.NewMemoryRepository(func() time.Time { return apitest.Now })
	settings := settingtest.Source{}
	quota := upload.NewQuotaService(uploadtest.NewMemoryQuotaRepository(), settings, func() time.Time { return apitest.Now })
	holds := uploadtest.NewMemoryHolds()
	uploads := upload.NewService(repo, quota, uploadtest.NewMemorySpool(), holds, &txtest.Immediate{}, settings, func() time.Time { return apitest.Now })
	store := &adminStore{}
	service := download.NewUploadService(download.UploadDeps{Store: store, Holds: holds, Uploads: uploads, Now: func() time.Time { return apitest.Now }})
	uploadhttp.NewAdminHandler(service, server.Builder).Register(server.API)
	return adminEnv{server: server, store: store, repo: repo}
}

func TestAdminUploadList(t *testing.T) {
	e := setupAdmin(t)
	started := apitest.Now.Add(-time.Hour)
	e.store.entries = []download.Upload{
		{Kind: download.UploadSession, ID: 7, FileName: "game.7z", Size: 10, UserID: 1, UserName: "alice", FailureCount: 2, Started: started,
			Session: &upload.Session{Status: upload.StatusUploading, TotalChunks: 3, UploadedChunks: []int{0, 2}, ExpiresAt: apitest.Now.Add(time.Hour)}},
		{Kind: download.UploadSession, ID: 6, FileName: "secret.7z", Size: 4, UserID: 1, UserName: "alice", Started: started,
			Session: &upload.Session{Status: upload.StatusCompleted, TotalChunks: 1, UploadedChunks: []int{0}, SubmittedAt: &started},
			Target:  &download.UploadTarget{FileID: 3, ResourceID: 5, ResourceStatus: download.ResourceActive, File: download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckEncrypted}, Game: download.UploadGame{ID: 2, TitleJP: "ゲーム"}}},
		{Kind: download.UploadAttempt, ID: 4, FileName: "unread.7z", Size: 5, UserID: 1, UserName: "alice", FailureCount: 1, Started: started},
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads", As: &member}), http.StatusForbidden, 403)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads?stage=uploading&search=game&userId=1&failed=true&page=2&pageSize=20", As: &admin})
	e.server.Expect(resp, http.StatusOK, 0)
	if f := e.store.filter; *f.Stage != download.UploadUploading || f.Query != "game" || *f.UserID != 1 || !f.FailedOnly || e.store.page != (download.Page{Number: 2, Size: 20}) {
		t.Fatalf("filter %+v page %+v", f, e.store.page)
	}
	want := `{"items":[` +
		`{"kind":"session","id":7,"file_name":"game.7z","size":10,"uploader":{"id":1,"name":"alice"},"stage":"uploading","file_stage":null,"rejection":null,"received":2,"chunks":3,"game":null,"failure_count":2,"started":"2026-10-03T00:02:03.000Z"},` +
		`{"kind":"session","id":6,"file_name":"secret.7z","size":4,"uploader":{"id":1,"name":"alice"},"stage":"rejected","file_stage":"rejected","rejection":"encrypted","received":1,"chunks":1,"game":{"id":2,"title_jp":"ゲーム","title_zh":"","title_en":""},"failure_count":0,"started":"2026-10-03T00:02:03.000Z"},` +
		`{"kind":"attempt","id":4,"file_name":"unread.7z","size":5,"uploader":{"id":1,"name":"alice"},"stage":"not_started","file_stage":null,"rejection":null,"received":0,"chunks":0,"game":null,"failure_count":1,"started":"2026-10-03T00:02:03.000Z"}],` +
		`"meta":{"totalItems":41,"itemCount":3,"itemsPerPage":20,"totalPages":3,"currentPage":2}}`
	if string(resp.Data) != want {
		t.Fatalf("list\n got %s\nwant %s", resp.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads?stage=lost", As: &admin}), http.StatusUnprocessableEntity, 100101)
}

func TestAdminUploadDetailAndTermination(t *testing.T) {
	e := setupAdmin(t)
	session := e.repo.Seed(upload.Session{Status: upload.StatusUploading, CreatorID: 1, TotalChunks: 2, ChunkSize: 4, HashAlgorithm: upload.HashBLAKE3, ExpiresAt: apitest.Now.Add(time.Hour)})
	status, ray := 403, "8f3c2a1b9d7e4c21-HKG"
	e.store.detail = download.UploadDetail{
		Upload: download.Upload{Kind: download.UploadSession, ID: session.ID, FileName: "game.7z", Size: 8, UserID: 1, UserName: "alice", FailureCount: 1, Started: apitest.Now, Session: &session},
		Failures: []upload.Failure{{ID: 3, UserID: 1, At: apitest.Now, FailureReport: upload.FailureReport{SessionID: &session.ID, Stage: upload.FailureSending, Reason: "rejected",
			Error: upload.ClientError{Name: "ApiError", Status: &status, Ray: &ray}, FileName: "game.7z", FileSize: 8, Client: "c41e", IP: "2409::1", UserAgent: "Chrome",
			Attempts: []upload.FailureAttempt{{At: apitest.Now, Wait: "network", Error: upload.ClientError{Name: "TypeError", Message: "Failed to fetch"}}}}}},
	}
	detail := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads/1", As: &admin})
	e.server.Expect(detail, http.StatusOK, 0)
	want := `{"kind":"session","id":1,"file_name":"game.7z","size":8,"uploader":{"id":1,"name":"alice"},"stage":"uploading","file_stage":null,"rejection":null,"received":0,"chunks":2,"game":null,"failure_count":1,"started":"2026-10-03T01:02:03.000Z",` +
		`"session":{"chunk_size":4,"hash_algorithm":"blake3","file_hash":"","expires_at":"2026-10-03T02:02:03.000Z","last_chunk_at":null,"completed_at":null,"submitted_at":null,"aborted_at":null,"ended_at":null,"updated":"2026-10-03T01:02:03.000Z"},` +
		`"target":null,"held":false,"failures":[{"id":3,"at":"2026-10-03T01:02:03.000Z","stage":"chunk","reason":"rejected","error":{"name":"ApiError","message":"","status":403,"code":null,"request_id":null,"ray":"8f3c2a1b9d7e4c21-HKG"},"chunk":null,"file_name":"game.7z","file_size":8,` +
		`"attempts":[{"at":"2026-10-03T01:02:03.000Z","wait":"network","error":{"name":"TypeError","message":"Failed to fetch","status":null,"code":null,"request_id":null,"ray":null}}],"client":"c41e","ip":"2409::1","user_agent":"Chrome"}]}`
	if string(detail.Data) != want {
		t.Fatalf("detail\n got %s\nwant %s", detail.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads/99", As: &admin}), http.StatusNotFound, 480104)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/uploads/attempts/4", As: &admin}), http.StatusNotFound, 480118)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/uploads/1/terminate", As: &member}), http.StatusForbidden, 403)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/uploads/1/terminate", As: &admin}), http.StatusOK, 0)
	if got, _ := e.repo.GetSession(context.Background(), session.ID); got.Status != upload.StatusAborted {
		t.Fatalf("terminated %+v", got)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/uploads/1/terminate", As: &admin}), http.StatusConflict, 480105)
}
