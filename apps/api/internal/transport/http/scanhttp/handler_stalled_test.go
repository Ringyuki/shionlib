package scanhttp_test

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
)

func seedStalled(t *testing.T, e env, id int) {
	t.Helper()
	at := apitest.Now.Add(-2 * 24 * time.Hour)
	session := 100 + id
	e.repo.SeedFile(scan.PendingFile{
		ID: id, ResourceID: id * 10, GameID: 7, Type: download.FileTypeObjectStore, Status: download.FileOnServer,
		CheckStatus: download.CheckStalled, CheckFailures: 6, StalledAt: &at,
		Path: "/spool/stalled.part", Name: "stalled.7z", Size: 2048, UploadSessionID: &session, CreatorID: member.UserID,
		Created: apitest.Now.Add(-3 * 24 * time.Hour),
	})
	e.repo.Names[member.UserID] = "uploader"
	e.repo.Titles[7] = scan.GameTitles{ID: 7, TitleJP: "ゲーム", TitleZH: "游戏"}
	if err := e.repo.RecordCheckFailure(context.Background(), id, scan.CheckFailure{Failures: 6, Reason: "clamd is down", StalledAt: &at}); err != nil {
		t.Fatal(err)
	}
}

func TestStalledChecksAreForAdmins(t *testing.T) {
	e := setup(t)
	for _, request := range []apitest.Request{
		{Method: http.MethodGet, Path: "/admin/content/stalled-checks"},
		{Method: http.MethodPost, Path: "/admin/content/stalled-checks/1/recheck"},
		{Method: http.MethodDelete, Path: "/admin/content/stalled-checks/1"},
	} {
		e.server.Expect(e.server.Do(request), http.StatusUnauthorized, 200101)
		request.As = &member
		e.server.Expect(e.server.Do(request), http.StatusForbidden, 403)
	}
}

func TestStalledChecksAreListedRecheckedAndRemoved(t *testing.T) {
	e := setup(t)
	seedStalled(t, e, 1)
	seedStalled(t, e, 2)

	resp := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/stalled-checks", As: &admin})
	e.server.Expect(resp, http.StatusOK, 0)
	first := `{"file_id":1,"file_name":"stalled.7z","file_size":2048,"resource_id":10,"game":{"id":7,"title_jp":"ゲーム","title_zh":"游戏","title_en":""},"uploader":{"id":9,"name":"uploader","avatar":null,"is_sponsor":false},"failures":6,"reason":"clamd is down","uploaded":"2026-09-30T01:02:03.000Z","stalled_at":"2026-10-01T01:02:03.000Z","deadline":"2026-10-08T01:02:03.000Z"}`
	if got := string(resp.Data); len(got) < len(first)+2 || got[1:len(first)+1] != first {
		t.Fatalf("list\n got %s\nwant [%s,…]", got, first)
	}

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/content/stalled-checks/1/recheck", As: &admin}), http.StatusOK, 0)
	if file, _ := e.repo.File(1); file.CheckStatus != download.CheckPending {
		t.Fatalf("the check starts over: %+v", file)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/admin/content/stalled-checks/1/recheck", As: &admin}), http.StatusNotFound, 440208)

	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/stalled-checks/2", As: &admin}), http.StatusOK, 0)
	if file, _ := e.repo.File(2); file.CheckStatus != download.CheckAbandoned {
		t.Fatalf("the file is given up: %+v", file)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/stalled-checks/2", As: &admin}), http.StatusNotFound, 440208)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodDelete, Path: "/admin/content/stalled-checks/0", As: &admin}), http.StatusUnprocessableEntity, 100101)

	resp = e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/stalled-checks", As: &admin})
	if e.server.Expect(resp, http.StatusOK, 0); string(resp.Data) != "[]" {
		t.Fatalf("nothing waits any more: %s", resp.Data)
	}
}
