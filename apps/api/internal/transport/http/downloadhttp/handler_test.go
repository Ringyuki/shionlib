package downloadhttp_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/downloadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var (
	creator    = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	visitor    = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin      = actor.Actor{UserID: 3, Role: actor.RoleAdmin}
	superAdmin = actor.Actor{UserID: 4, Role: actor.RoleSuperAdmin}
)

type sessions struct{}

func (sessions) Claim(_ context.Context, who actor.Actor, id int) (upload.Session, error) {
	if id != 5 {
		return upload.Session{}, upload.ErrSessionNotFound
	}
	if who.UserID != creator.UserID {
		return upload.Session{}, upload.ErrSessionNotOwner
	}
	return upload.Session{ID: 5, Status: upload.StatusCompleted, CreatorID: creator.UserID, FileName: "s.7z", StoragePath: "/spool/5.part", TotalSize: 9, FileHash: "h", HashAlgorithm: upload.HashBLAKE3}, nil
}

type quota struct{}

func (quota) Withdraw(context.Context, int, int) error {
	return nil
}

type env struct {
	server    *apitest.Server
	repo      *downloadtest.MemoryRepository
	store     *downloadtest.ObjectStore
	challenge *downloadtest.Challenge
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	now := func() time.Time { return apitest.Now }
	repo := downloadtest.NewMemoryRepository(now)
	events := &downloadtest.Recorder{}
	store := downloadtest.NewObjectStore()
	cards := gametest.NewCards(game.Card{ID: 10, TitleJP: "ゲーム", Covers: []game.Cover{{URL: "safe.webp"}, {URL: "rated.webp", Sexual: 1}}})
	service := download.NewService(download.Deps{Repo: repo, Games: cards, Sessions: sessions{}, Quota: quota{}, Activities: events, Messages: events, Tx: &txtest.Immediate{}, Queue: events, Store: store, Now: now})
	challenge := &downloadtest.Challenge{Verdict: download.Verdict{Success: true}}
	links := download.NewLinkService(repo, &txtest.Immediate{}, challenge, &downloadtest.Authorizer{}, &downloadtest.Sealer{}, download.LinkOptions{Mode: download.ModeDirect, CDNHost: "https://cdn.example.com/", BaseExpiresIn: time.Hour, EstimatedSpeed: 1 << 20, MaxExpiresIn: 24 * time.Hour}, now)
	downloadhttp.NewHandler(service, links, server.Builder).Register(server.API)
	return env{server: server, repo: repo, store: store, challenge: challenge}
}

func ptr[T any](v T) *T {
	return &v
}

func (e env) seedStoredFile() (download.Resource, download.File) {
	resource := e.repo.SeedResource(download.Resource{GameID: 10, CreatorID: creator.UserID, Platforms: []string{"win"}, Languages: []string{"jp"}, Note: ptr("note")})
	file := e.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Size: 2048, Status: download.FileInObjectStore, StorageKey: ptr("games/10/1/game.7z"), Hash: "b3", CreatorID: creator.UserID})
	return resource, file
}

func TestGameResourcesShape(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/10/download-source"})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `[{"id":1,"platform":["win"],"language":["jp"],"simulator":null,"note":"note","downloads":0,"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z","files":[{"id":1,"type":1,"file_name":"game.7z","file_size":2048,"file_url":null,"s3_file_key":"games/10/1/game.7z","hash_algorithm":"blake3","file_hash":"b3","file_status":3,"is_virus_false_positive":false,"malware_scan_cases":[],"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"latest_history":null}]}]`
	if string(resp.Data) != want {
		t.Fatalf("game resources\n got %s\nwant %s", resp.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/404/download-source"}), http.StatusNotFound, 400101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/abc/download-source"}), http.StatusUnprocessableEntity, 100101)
}

func TestDownloadLink(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	path := "/game/download/1/link"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path}), http.StatusBadRequest, 450102)
	e.challenge.Verdict = download.Verdict{ErrorCodes: []string{"invalid-input-response"}}
	invalid := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?token=t"})
	e.server.Expect(invalid, http.StatusForbidden, 450103)
	if !strings.Contains(invalid.Message, "invalid-input-response") || invalid.HasData && string(invalid.Data) != "null" {
		t.Fatalf("invalid token %s", invalid.Body)
	}
	e.challenge.Verdict = download.Verdict{Success: true}
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?token=t"})
	e.server.Expect(resp, http.StatusOK, 0)
	if string(resp.Data) != `{"file_url":"https://cdn.example.com/games%2F10%2F1%2Fgame.7z?Authorization=dl-token","expires_in":3601}` {
		t.Fatalf("link %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download/999/link?token=t"}), http.StatusNotFound, 450101)
}

func TestCreateDownloadSource(t *testing.T) {
	e := setup(t)
	path := "/game/10/download-source"
	body := map[string]any{"file_name": "x.7z", "platform": []string{"win"}, "language": []string{"jp"}, "upload_session_id": 5}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: body}), http.StatusUnauthorized, 200101)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: body})
	e.server.Expect(resp, http.StatusCreated, 0)
	if resp.HasData {
		t.Fatalf("create omits data: %s", resp.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: body}), http.StatusConflict, 440103)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &visitor, Body: body}), http.StatusForbidden, 480113)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/404/download-source", As: &creator, Body: body}), http.StatusNotFound, 400101)

	mobile := map[string]any{"file_name": "x.apk", "platform": []string{"and"}, "language": []string{"jp"}, "upload_session_id": 5}
	missing := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: mobile})
	e.server.Expect(missing, http.StatusUnprocessableEntity, 100101)
	if !strings.Contains(string(missing.Data), `"field":"simulator"`) {
		t.Fatalf("mobile platforms require a simulator: %s", missing.Data)
	}
	badEnum := map[string]any{"file_name": "x", "platform": []string{"nes"}, "language": []string{"jp"}, "upload_session_id": 5}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: badEnum}), http.StatusUnprocessableEntity, 100101)
	emptyPlatforms := map[string]any{"file_name": "x", "platform": []string{}, "language": []string{"jp"}, "upload_session_id": 5}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: emptyPlatforms}), http.StatusUnprocessableEntity, 100101)
	longNote := map[string]any{"file_name": "x", "platform": []string{"win"}, "language": []string{"jp"}, "upload_session_id": 5, "note": strings.Repeat("n", 256)}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: longNote}), http.StatusUnprocessableEntity, 100101)
}

func TestEditAndDelete(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	path := "/game/download-source/1"
	body := map[string]any{"platform": []string{"ios"}, "language": []string{"zh"}, "simulator": "KRKR"}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &visitor, Body: body}), http.StatusForbidden, 440102)
	resp := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &creator, Body: body})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData {
		t.Fatalf("edit omits data: %s", resp.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/99", As: &creator, Body: body}), http.StatusNotFound, 440101)
	forbidden := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &admin})
	e.server.Expect(forbidden, http.StatusForbidden, 403)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &superAdmin}), http.StatusOK, 0)
	if len(e.store.Deleted) != 1 || e.store.Deleted[0] != "games/10/1/game.7z" {
		t.Fatalf("stored objects are deleted: %v", e.store.Deleted)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: path, As: &superAdmin}), http.StatusNotFound, 440101)
}

func TestReleasesAndUserResources(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	e.repo.MarkUploading(creator.UserID)
	releases := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/list?page=1&pageSize=25", As: &creator})
	e.server.Expect(releases, http.StatusOK, 0)
	if !strings.Contains(string(releases.Data), `"files":["game.7z"],"files_count":1`) || !strings.HasSuffix(string(releases.Data), `"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":25,"totalPages":1,"currentPage":1,"content_limit":1}}`) {
		t.Fatalf("releases %s", releases.Data)
	}
	if strings.Contains(string(releases.Data), "rated.webp") {
		t.Fatalf("strict viewers never see rated covers: %s", releases.Data)
	}
	mine := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/game-resources", As: &creator})
	e.server.Expect(mine, http.StatusOK, 0)
	if !strings.Contains(string(mine.Data), `"file_name":"game.7z","more_than_one_file":false,"files_count":1`) || !strings.HasSuffix(string(mine.Data), `"is_current_user":true,"has_on_going_session":true,"content_limit":1}}`) {
		t.Fatalf("user resources %s", mine.Data)
	}
	theirs := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/user/datas/1/game-resources"})
	if !strings.HasSuffix(string(theirs.Data), `"is_current_user":false,"has_on_going_session":false,"content_limit":0}}`) {
		t.Fatalf("guest view %s", theirs.Data)
	}
}

func TestMigrationRoutes(t *testing.T) {
	e := setup(t)
	body := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/migrate/10", As: &admin, Body: body}), http.StatusForbidden, 403)
	created := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/migrate/10", As: &superAdmin, Body: body})
	e.server.Expect(created, http.StatusCreated, 0)
	if string(created.Data) != "1" {
		t.Fatalf("migrated resource id %s", created.Data)
	}
	file := map[string]any{"file_name": "a.7z", "file_size": 10, "file_hash": "h", "file_content_type": "application/x-7z-compressed", "s3_file_key": "games/10/1/a.7z"}
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/migrate/file/1", As: &superAdmin, Body: file})
	e.server.Expect(resp, http.StatusCreated, 0)
	if resp.HasData {
		t.Fatalf("file migration omits data: %s", resp.Body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/migrate/file/99", As: &superAdmin, Body: file}), http.StatusNotFound, 440101)
}

func TestReuploadAndHistory(t *testing.T) {
	e := setup(t)
	_, file := e.seedStoredFile()
	e.repo.SeedHistory(download.History{FileID: file.ID, OperatorID: creator.UserID, Size: 2048, Hash: "b3", HashAlgorithm: upload.HashBLAKE3, StorageKey: ptr("games/10/1/game.7z"), Created: apitest.Now})
	history := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/file/1/history"})
	e.server.Expect(history, http.StatusOK, 0)
	if string(history.Data) != `[{"id":1,"file_size":2048,"hash_algorithm":"blake3","file_hash":"b3","s3_file_key":"games/10/1/game.7z","reason":null,"operator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"created":"2026-10-03T01:02:03.000Z"}]` {
		t.Fatalf("history %s", history.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/file/99/history"}), http.StatusNotFound, 450101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/file-history/1/reason", As: &visitor, Body: map[string]any{"reason": "x"}}), http.StatusForbidden, 450104)
	reason := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/file-history/1/reason", As: &creator, Body: map[string]any{"reason": "x"}})
	e.server.Expect(reason, http.StatusOK, 0)

	reupload := e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/game/download-source/file/1/reupload", As: &creator, Body: map[string]any{"upload_session_id": 5, "reason": "fix"}})
	e.server.Expect(reupload, http.StatusOK, 0)
	if string(reupload.Data) != `{"ok":true}` {
		t.Fatalf("reupload %s", reupload.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPut, Path: "/game/download-source/file/1/reupload", As: &creator, Body: map[string]any{"upload_session_id": 5}}), http.StatusConflict, 480115)
}

func TestStorageTestRoutes(t *testing.T) {
	e := setup(t)
	modified := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	e.store.Listing = download.Listing{Name: "game-bucket", KeyCount: 1, MaxKeys: 1000, Objects: []download.ObjectInfo{{Key: "games/1/a.7z", LastModified: &modified, ETag: `"etag"`, Size: 5, StorageClass: "STANDARD"}}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/s3/test/file/list", As: &admin}), http.StatusForbidden, 403)
	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/s3/test/file/list", As: &superAdmin})
	e.server.Expect(list, http.StatusOK, 0)
	if string(list.Data) != `{"Contents":[{"Key":"games/1/a.7z","LastModified":"2026-01-02T03:04:05.000Z","ETag":"\"etag\"","Size":5,"StorageClass":"STANDARD"}],"IsTruncated":false,"KeyCount":1,"MaxKeys":1000,"Name":"game-bucket","Prefix":""}` {
		t.Fatalf("listing %s", list.Data)
	}
	resp := e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/s3/test/file?key=a%2Fb%2Fc.txt", As: &superAdmin})
	e.server.Expect(resp, http.StatusOK, 0)
	if resp.HasData || len(e.store.Deleted) != 1 || e.store.Deleted[0] != "a/b/c.txt" {
		t.Fatalf("delete %s %v", resp.Body, e.store.Deleted)
	}
}
