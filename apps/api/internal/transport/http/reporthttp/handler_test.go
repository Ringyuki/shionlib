package reporthttp_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/report/reporttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reporthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	uploader = actor.Actor{UserID: 10, Role: actor.RoleUser}
	reporter = actor.Actor{UserID: 20, Role: actor.RoleUser}
	admin    = actor.Actor{UserID: 2, Role: actor.RoleAdmin}
)

type env struct {
	server    *apitest.Server
	repo      *reporttest.MemoryRepository
	resources *reporttest.Resources
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	repo := reporttest.NewMemoryRepository(func() time.Time { return apitest.Now })
	resources := reporttest.NewResources()
	resources.Items[5] = download.Resource{ID: 5, GameID: 7, Status: download.ResourceActive, CreatorID: uploader.UserID}
	repo.GameOf[5] = 7
	repo.Games[7] = report.GameTitles{ID: 7, TitleJP: "ゲーム"}
	repo.AddMember(uploader.UserID, 1, 1, "uploader")
	repo.AddMember(reporter.UserID, 1, 1, "reporter")
	events := &downloadtest.Recorder{}
	service := report.NewService(report.Deps{
		Repo:      repo,
		Resources: resources,
		Quota:     &reporttest.Quota{},
		Banner:    &reporttest.Banner{},
		Messages:  events,
		Queue:     events,
		Tx:        &txtest.Immediate{},
		Now:       func() time.Time { return apitest.Now },
	})
	reporthttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, repo: repo, resources: resources}
}

func TestCreateReport(t *testing.T) {
	e := setup(t)
	path := "/game/download-source/5/report"
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, Body: map[string]any{"reason": "MALWARE"}}), http.StatusUnauthorized, 200101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &reporter, Body: map[string]any{"reason": "SPAM"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &reporter, Body: map[string]any{"reason": "OTHER", "detail": strings.Repeat("d", 501)}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &uploader, Body: map[string]any{"reason": "MALWARE"}}), http.StatusBadRequest, 440202)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: "/game/download-source/9/report", As: &reporter, Body: map[string]any{"reason": "MALWARE"}}), http.StatusNotFound, 440101)
	resp := e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &reporter, Body: map[string]any{"reason": "MALWARE", "detail": "virus"}})
	e.server.Expect(resp, http.StatusCreated, 0)
	if string(resp.Data) != `{"id":1,"status":"PENDING","reason":"MALWARE","malicious_level":"CRITICAL","created":"2026-10-03T01:02:03.000Z"}` {
		t.Fatalf("created %s", resp.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPost, Path: path, As: &reporter, Body: map[string]any{"reason": "MALWARE"}}), http.StatusConflict, 440201)
}

func TestAdminReportRoutes(t *testing.T) {
	e := setup(t)
	e.repo.Seed(report.Report{ResourceID: 5, ReporterID: reporter.UserID, ReportedUserID: uploader.UserID, Reason: report.ReasonBrokenLink, Level: report.LevelLow})
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/download-resource-reports", As: &reporter}), http.StatusForbidden, 403)
	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/download-resource-reports?status=PENDING&sortBy=id&sortOrder=asc", As: &admin})
	e.server.Expect(list, http.StatusOK, 0)
	want := `{"items":[{"id":1,"reason":"BROKEN_LINK","detail":null,"status":"PENDING","malicious_level":"LOW","processed_at":null,"process_note":null,"created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z","resource":{"id":5,"game_id":7,"game":{"id":7,"title_jp":"ゲーム","title_zh":"","title_en":""},"files":[]},"reporter":{"id":20,"name":"reporter","avatar":null,"is_sponsor":false},"reported_user":{"id":10,"name":"uploader","avatar":null,"is_sponsor":false},"processor":null}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(list.Data) != want {
		t.Fatalf("list\n got %s\nwant %s", list.Data, want)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/download-resource-reports?sortBy=name", As: &admin}), http.StatusUnprocessableEntity, 100101)
	detail := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/download-resource-reports/1", As: &admin})
	e.server.Expect(detail, http.StatusOK, 0)
	if !strings.Contains(string(detail.Data), `"reporter":{"id":20,"name":"reporter","avatar":null,"is_sponsor":false,"role":1,"status":1}`) || !strings.Contains(string(detail.Data), `"reporter_penalty_applied":false`) {
		t.Fatalf("detail %s", detail.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/download-resource-reports/9", As: &admin}), http.StatusNotFound, 440203)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/download-resource-reports/1/review", As: &admin, Body: map[string]any{"verdict": "MAYBE"}}), http.StatusUnprocessableEntity, 100101)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/download-resource-reports/1/review", As: &admin, Body: map[string]any{"verdict": "VALID", "notify": 0}}), http.StatusUnprocessableEntity, 100101)
	reviewed := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/download-resource-reports/1/review", As: &admin, Body: map[string]any{"verdict": "VALID", "process_note": "ok"}})
	e.server.Expect(reviewed, http.StatusOK, 0)
	if !strings.Contains(string(reviewed.Data), `"status":"VALID"`) || !strings.Contains(string(reviewed.Data), `"process_note":"ok"`) {
		t.Fatalf("reviewed %s", reviewed.Data)
	}
	if len(e.resources.TakenDown) != 1 {
		t.Fatal("a plain admin can confirm a report and take the resource down")
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/download-resource-reports/1/review", As: &admin, Body: map[string]any{"verdict": "INVALID"}}), http.StatusConflict, 440204)
}
