package downloadhttp_test

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator/translatortest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/downloadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	creator    = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	visitor    = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin      = actor.Actor{UserID: 3, Role: actor.RoleAdmin}
	superAdmin = actor.Actor{UserID: 4, Role: actor.RoleSuperAdmin}
)

type sessions struct{}

func (sessions) Claim(_ context.Context, who actor.Actor, id int) (upload.Session, error) {
	if id < 5 || id > 8 {
		return upload.Session{}, upload.ErrSessionNotFound
	}
	if who.UserID != creator.UserID {
		return upload.Session{}, upload.ErrSessionNotOwner
	}
	return upload.Session{ID: id, Status: upload.StatusCompleted, CreatorID: creator.UserID, FileName: fmt.Sprintf("s%d.7z", id), StoragePath: fmt.Sprintf("/spool/%d.part", id), TotalSize: 9, FileHash: "h", HashAlgorithm: upload.HashBLAKE3}, nil
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
	settings := settingtest.Set(settingtest.Source{}, download.MaxFilesPerResource, 3)
	discussions := downloadtest.Discussions{Counts: map[int]int{1: 3}}
	service := download.NewService(download.Deps{Repo: repo, Games: cards, Comments: discussions, Translators: translator.NewService(translatortest.NewMemoryRepository()), Sessions: sessions{}, Activities: events, Messages: events, Tx: &txtest.Immediate{}, Queue: events, Store: store, Local: uploadtest.NewMemorySpool(), Settings: settings, Now: now})
	challenge := &downloadtest.Challenge{Verdict: download.Verdict{Success: true}}
	links := download.NewLinkService(repo, &txtest.Immediate{}, challenge, &downloadtest.Authorizer{}, &downloadtest.Sealer{}, settingtest.Source{}, download.LinkOptions{Mode: download.ModeDirect, CDNHost: "https://cdn.example.com/"}, now)
	downloadhttp.NewHandler(service, download.NewDetailService(repo, cards, discussions, settings), links, server.Builder).Register(server.API)
	return env{server: server, repo: repo, store: store, challenge: challenge}
}

func ptr[T any](v T) *T {
	return &v
}

func (e env) seedStoredFile() (download.Resource, download.File) {
	resource := e.repo.SeedResource(download.Resource{GameID: 10, CreatorID: creator.UserID, Platforms: []string{"win"}, Languages: []string{"jp"}, Note: ptr("note"), PublishedAt: ptr(apitest.Now)})
	file := e.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Size: 2048, Status: download.FileInObjectStore, StorageKey: ptr("games/10/1/game.7z"), Hash: "b3", CreatorID: creator.UserID})
	return resource, file
}

func TestGameResourcesShape(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/10/download-source"})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `[{"id":1,"platform":["win"],"language":["jp"],"simulator":null,"note":"note","translation":null,"translators":[],"patch_version":null,"release_url":null,"edition":null,"edition_name":null,"form":null,"extras":[],"downloads":0,"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"published_at":"2026-10-03T01:02:03.000Z","created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z","comments":3,"files":[{"id":1,"type":1,"file_name":"game.7z","file_size":2048,"file_url":null,"s3_file_key":"games/10/1/game.7z","hash_algorithm":"blake3","file_hash":"b3","file_status":3,"stage":"stored","rejection":null,"is_virus_false_positive":false,"malware_scan_cases":[],"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"latest_history":null,"uploaded":"2026-10-03T01:02:03.000Z","sha256":null,"inspection_id":null}],"missing_volumes":[],"volumes_deadline":null}]`
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

func TestAnIncompleteSetTellsItsUploaderWhatIsMissing(t *testing.T) {
	e := setup(t)
	resource := e.repo.SeedResource(download.Resource{GameID: 10, CreatorID: creator.UserID, Platforms: []string{"win"}, Languages: []string{"jp"}})
	e.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.r00", Status: download.FileOnServer, CreatorID: creator.UserID})
	e.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.rar", Status: download.FileOnServer, CreatorID: creator.UserID})
	e.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.r02", Status: download.FileOnServer, CreatorID: creator.UserID})
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/10/download-source", As: &creator})
	e.server.Expect(resp, http.StatusOK, 0)
	body := string(resp.Data)
	for _, part := range []string{
		`"missing_volumes":["game.r01"],"volumes_deadline":"2026-10-04T01:02:03.000Z"`,
		`"file_name":"game.rar"`,
		`"stage":"awaiting_volumes"`,
	} {
		if !strings.Contains(body, part) {
			t.Fatalf("missing %s in %s", part, body)
		}
	}
	if first, second, third := strings.Index(body, `"file_name":"game.rar"`), strings.Index(body, `"file_name":"game.r00"`), strings.Index(body, `"file_name":"game.r02"`); first > second || second > third {
		t.Fatalf("the volume that opens the set comes first: %s", body)
	}
	if strings.Contains(body, `"stage":"checking"`) {
		t.Fatalf("every volume of the set waits: %s", body)
	}
}

func TestCreateDownloadSource(t *testing.T) {
	e := setup(t)
	path := "/game/10/download-source"
	files := func(ids ...int) []map[string]any {
		out := make([]map[string]any, len(ids))
		for i, id := range ids {
			out[i] = map[string]any{"upload_session_id": id}
		}
		return out
	}
	body := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": []map[string]any{{"upload_session_id": 5, "file_name": "本体.7z"}, {"upload_session_id": 6}}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: body}), http.StatusUnauthorized, 200101)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: body})
	e.server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"id":1}` {
		t.Fatalf("create returns the resource id: %s", resp.Data)
	}
	stored, _ := e.repo.ListFiles(context.Background(), 1)
	if len(stored) != 2 || stored[0].Name != "本体.7z" || stored[1].Name != "s6.7z" {
		t.Fatalf("files %+v", stored)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: body}), http.StatusConflict, 440103)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &visitor, Body: body}), http.StatusForbidden, 480113)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/404/download-source", As: &creator, Body: body}), http.StatusNotFound, 400101)
	tooMany := map[string]any{"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": files(5, 6, 7, 8)}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: tooMany}), http.StatusBadRequest, 440104)

	invalid := map[string]map[string]any{
		"mobile without simulator": {"platform": []string{"and"}, "language": []string{"jp"}, "form": "portable", "files": files(7)},
		"unknown platform":         {"platform": []string{"nes"}, "language": []string{"jp"}, "form": "portable", "files": files(7)},
		"no platform":              {"platform": []string{}, "language": []string{"jp"}, "form": "portable", "files": files(7)},
		"long note":                {"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": files(7), "note": strings.Repeat("n", 256)},
		"no files":                 {"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": []map[string]any{}},
		"long file name":           {"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "files": []map[string]any{{"upload_session_id": 7, "file_name": strings.Repeat("n", 256)}}},
		"no form":                  {"platform": []string{"win"}, "language": []string{"jp"}, "files": files(7)},
		"unknown form":             {"platform": []string{"win"}, "language": []string{"jp"}, "form": "floppy", "files": files(7)},
		"unknown translation":      {"platform": []string{"win"}, "language": []string{"zh"}, "form": "portable", "translation": "fan", "files": files(7)},
		"translation left out":     {"platform": []string{"win"}, "language": []string{"zh"}, "form": "portable", "files": files(7)},
		"a group without a name":   {"platform": []string{"win"}, "language": []string{"zh"}, "form": "portable", "translation": "group", "files": files(7)},
		"too many extras":          {"platform": []string{"win"}, "language": []string{"jp"}, "form": "portable", "extras": []string{"save", "bonus", "save"}, "files": files(7)},
		"long patch version":       {"platform": []string{"win"}, "language": []string{"zh"}, "form": "portable", "translation": "machine", "patch_version": strings.Repeat("v", 33), "files": files(7)},
	}
	for name, invalidBody := range invalid {
		resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &creator, Body: invalidBody})
		if resp.Status != http.StatusUnprocessableEntity || resp.Code != 100101 {
			t.Fatalf("%s: %d %s", name, resp.Status, resp.Body)
		}
	}
}

func TestFileRoutes(t *testing.T) {
	e := setup(t)
	resource, file := e.seedStoredFile()
	filesPath := fmt.Sprintf("/game/download-source/%d/files", resource.ID)
	add := map[string]any{"files": []map[string]any{{"upload_session_id": 7, "file_name": "patch.zip"}}}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: filesPath, As: &visitor, Body: add}), http.StatusForbidden, 440102)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: filesPath, As: &creator, Body: add}), http.StatusCreated, 0)
	stored, _ := e.repo.ListFiles(context.Background(), resource.ID)
	if len(stored) != 2 || stored[1].Name != "patch.zip" {
		t.Fatalf("files after adding %+v", stored)
	}

	filePath := fmt.Sprintf("/game/download-source/file/%d", file.ID)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: filePath, As: &visitor, Body: map[string]any{"file_name": "x.7z"}}), http.StatusForbidden, 450104)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: filePath, As: &creator, Body: map[string]any{"file_name": ""}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: filePath, As: &creator, Body: map[string]any{"file_name": "本体.7z"}}), http.StatusOK, 0)
	if renamed, _ := e.repo.GetFile(context.Background(), file.ID); renamed.Name != "本体.7z" {
		t.Fatalf("renamed %+v", renamed)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: filePath, As: &visitor}), http.StatusForbidden, 450104)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: filePath, As: &creator}), http.StatusOK, 0)
	last := fmt.Sprintf("/game/download-source/file/%d", stored[1].ID)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: last, As: &creator}), http.StatusConflict, 440105)
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

func TestOwnResources(t *testing.T) {
	e := setup(t)
	e.seedStoredFile()
	waiting := e.repo.SeedResource(download.Resource{GameID: 10, CreatorID: creator.UserID, Platforms: []string{"win"}, Languages: []string{"jp"}})
	e.repo.SeedFile(download.File{ResourceID: waiting.ID, Name: "locked.7z", Size: 7, Status: download.FileOnServer, CheckStatus: download.CheckEncrypted, Hash: "b3", CreatorID: creator.UserID})
	e.repo.SeedFile(download.File{ResourceID: waiting.ID, Name: "fine.7z", Size: 7, Status: download.FileOnServer, CheckStatus: download.CheckOK, Hash: "b3", CreatorID: creator.UserID})

	path := "/game/download-source/mine"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?scope=everything", As: &creator}), http.StatusUnprocessableEntity, 100101)

	published := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?scope=published", As: &creator})
	e.server.Expect(published, http.StatusOK, 0)
	want := `{"items":[{"resource":{"id":1,"platform":["win"],"language":["jp"],"simulator":null,"note":"note","translation":null,"translators":[],"patch_version":null,"release_url":null,"edition":null,"edition_name":null,"form":null,"extras":[],"downloads":0,"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"published_at":"2026-10-03T01:02:03.000Z","created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z","comments":3,"files":[{"id":1,"type":1,"file_name":"game.7z","file_size":2048,"file_url":null,"s3_file_key":"games/10/1/game.7z","hash_algorithm":"blake3","file_hash":"b3","file_status":3,"stage":"stored","rejection":null,"is_virus_false_positive":false,"malware_scan_cases":[],"creator":{"id":1,"name":"user1","avatar":null,"is_sponsor":false},"latest_history":null,"uploaded":"2026-10-03T01:02:03.000Z","sha256":null,"inspection_id":null}],"missing_volumes":[],"volumes_deadline":null},"game":{"id":10,`
	if !strings.HasPrefix(string(published.Data), want) || !strings.HasSuffix(string(published.Data), `"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`) {
		t.Fatalf("published resources of the caller\n got %s\nwant %s", published.Data, want)
	}
	if strings.Contains(string(published.Data), "rated.webp") {
		t.Fatalf("strict viewers never see rated covers: %s", published.Data)
	}

	processing := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?scope=processing&pageSize=5", As: &creator})
	e.server.Expect(processing, http.StatusOK, 0)
	for _, part := range []string{`"published_at":null`, `"file_name":"locked.7z","file_size":7,"file_url":null,"s3_file_key":null,"hash_algorithm":"blake3","file_hash":"b3","file_status":2,"stage":"rejected","rejection":"encrypted"`, `"file_name":"fine.7z","file_size":7,"file_url":null,"s3_file_key":null,"hash_algorithm":"blake3","file_hash":"b3","file_status":2,"stage":"storing","rejection":null`, `"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":5,"totalPages":1,"currentPage":1}}`} {
		if !strings.Contains(string(processing.Data), part) {
			t.Fatalf("processing resources miss %s in %s", part, processing.Data)
		}
	}
	nobody := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path, As: &visitor})
	if !strings.HasPrefix(string(nobody.Data), `{"items":[],`) {
		t.Fatalf("someone else sees none of them: %s", nobody.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?sort_by=size", As: &creator}), http.StatusUnprocessableEntity, 100101)
	everything := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "?q=LOCKED&sort_by=downloads&sort_order=asc", As: &creator})
	e.server.Expect(everything, http.StatusOK, 0)
	if !strings.Contains(string(everything.Data), `"file_name":"locked.7z"`) || !strings.HasSuffix(string(everything.Data), `"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`) {
		t.Fatalf("search across every scope: %s", everything.Data)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "/summary"}), http.StatusUnauthorized, 200101)
	summary := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "/summary", As: &creator})
	e.server.Expect(summary, http.StatusOK, 0)
	if string(summary.Data) != `{"processing":1,"published":1,"downloads":0,"games":1,"files":3,"recent":2,"recent_days":30}` {
		t.Fatalf("summary %s", summary.Data)
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

func TestResourceDetailAndItsHistory(t *testing.T) {
	e := setup(t)
	resource, file := e.seedStoredFile()
	path := "/game/download-source/" + strconv.Itoa(resource.ID)

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path})
	e.server.Expect(resp, http.StatusOK, 0)
	body := string(resp.Data)
	for _, part := range []string{`{"resource":{"id":1,"platform":["win"]`, `"comments":3,"files":[{"id":1,"type":1,"file_name":"game.7z"`, `"game":{"id":10,"title_jp":"ゲーム"`, `"covers":[{"language":"","type":"","url":"safe.webp"`} {
		if !strings.Contains(body, part) {
			t.Fatalf("detail is missing %s in %s", part, body)
		}
	}
	if strings.Contains(body, "rated.webp") {
		t.Fatalf("a guest never gets the rated cover: %s", body)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/999"}), http.StatusNotFound, 440101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/abc"}), http.StatusUnprocessableEntity, 100101)

	hidden := e.repo.SeedResource(download.Resource{GameID: 10, CreatorID: creator.UserID})
	e.repo.SeedFile(download.File{ResourceID: hidden.ID, Name: "new.7z", Status: download.FileOnServer, CreatorID: creator.UserID})
	hiddenPath := "/game/download-source/" + strconv.Itoa(hidden.ID)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: hiddenPath}), http.StatusNotFound, 440101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: hiddenPath, As: &creator}), http.StatusOK, 0)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: hiddenPath + "/events"}), http.StatusNotFound, 440101)

	rename := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/file/" + strconv.Itoa(file.ID), As: &creator, Body: `{"file_name":"本体.7z"}`})
	e.server.Expect(rename, http.StatusOK, 0)
	edit := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: path, As: &creator, Body: `{"platform":["win"],"language":["jp","zh"],"note":"官方中文","translation":"official","form":"portable"}`})
	e.server.Expect(edit, http.StatusOK, 0)

	events := e.server.Do(apitest.Request{Method: http.MethodGet, Path: path + "/events"})
	e.server.Expect(events, http.StatusOK, 0)
	actor := `{"id":1,"name":"user1","avatar":null,"is_sponsor":false}`
	want := `[{"id":2,"kind":"edited","actor":` + actor + `,"created":"2026-10-03T01:02:03.000Z","files":[],"name":null,"old_name":null,"reason":null,"old_size":null,"new_size":null,` +
		`"changes":[{"field":"languages","old":["jp"],"new":["jp","zh"]},{"field":"note","old":["note"],"new":["官方中文"]},{"field":"translation","old":[],"new":["official"]},{"field":"form","old":[],"new":["portable"]}]},` +
		`{"id":1,"kind":"file_renamed","actor":` + actor + `,"created":"2026-10-03T01:02:03.000Z","files":[],"name":"本体.7z","old_name":"game.7z","reason":null,"old_size":null,"new_size":null,"changes":[]}]`
	if string(events.Data) != want {
		t.Fatalf("events\n got %s\nwant %s", events.Data, want)
	}
}

func TestCreateWithATranslationShowsItsCredits(t *testing.T) {
	e := setup(t)
	body := map[string]any{
		"platform": []string{"win"}, "language": []string{"zh"}, "form": "portable", "translation": "group", "translators": []string{"绿茶汉化组", "熊喵守护协会"},
		"patch_version": "v1.1", "release_url": "https://example.org/release", "edition": "download", "edition_name": "初回限定版", "extras": []string{"save"},
		"files": []map[string]any{{"upload_session_id": 5}},
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/10/download-source", As: &creator, Body: body}), http.StatusCreated, 0)
	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/1", As: &creator})
	e.server.Expect(resp, http.StatusOK, 0)
	want := `"translation":"group","translators":[{"id":1,"name":"绿茶汉化组"},{"id":2,"name":"熊喵守护协会"}],"patch_version":"v1.1","release_url":"https://example.org/release","edition":"download","edition_name":"初回限定版","form":"portable","extras":["save"],`
	if !strings.Contains(string(resp.Data), want) {
		t.Fatalf("resource information\n got %s\nwant %s", resp.Data, want)
	}
	edited := map[string]any{"platform": []string{"win"}, "language": []string{"zh"}, "translation": "machine", "patch_version": "v2", "form": "installer"}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/1", As: &creator, Body: edited}), http.StatusOK, 0)
	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/game/download-source/1", As: &creator})
	want = `"translation":"machine","translators":[],"patch_version":"v2","release_url":null,"edition":null,"edition_name":null,"form":"installer","extras":[],`
	if !strings.Contains(string(resp.Data), want) {
		t.Fatalf("edited information\n got %s\nwant %s", resp.Data, want)
	}
	tooMany := map[string]any{"platform": []string{"win"}, "language": []string{"zh"}, "translation": "group", "translators": []string{"一", "二", "三", "四", "五", "六", "七"}}
	resp = e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/game/download-source/1", As: &creator, Body: tooMany})
	if resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("more translators than a resource may credit: %d %s", resp.Status, resp.Body)
	}
}
