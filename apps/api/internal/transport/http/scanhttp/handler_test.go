package scanhttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apitest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/scanhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	member = actor.Actor{UserID: 9, Role: actor.RoleUser}
	admin  = actor.Actor{UserID: 2, Role: actor.RoleAdmin}
)

type quotaFake struct{}

func (quotaFake) Withdraw(context.Context, int, int) error {
	return nil
}

type env struct {
	server *apitest.Server
	repo   *scantest.MemoryRepository
	events *downloadtest.Recorder
}

func setup(t *testing.T) env {
	t.Helper()
	server := apitest.New(t)
	now := func() time.Time { return apitest.Now }
	repo := scantest.NewMemoryRepository(now)
	events := &downloadtest.Recorder{}
	service := scan.NewService(scan.Deps{
		Repo:       repo,
		Archives:   &scantest.ArchiveTool{},
		Scanner:    &scantest.Scanner{},
		Files:      repo,
		Local:      uploadtest.NewMemorySpool(),
		Quota:      quotaFake{},
		Activities: events,
		Messages:   events,
		Banner:     &scantest.Banner{},
		Queue:      events,
		Tx:         &txtest.Immediate{},
		Options:    scan.Options{AutoBanThreshold: 3, AutoBanDays: 30},
		Now:        now,
	})
	scanhttp.NewHandler(service, server.Builder).Register(server.API)
	return env{server: server, repo: repo, events: events}
}

func seedCase(repo *scantest.MemoryRepository) scan.Case {
	repo.SeedFile(scan.PendingFile{ID: 1, ResourceID: 10, GameID: 7, Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview, Path: "/spool/1.part", Name: "a.7z", CreatorID: member.UserID})
	repo.Names[member.UserID] = "uploader"
	fileID, resourceID, gameID := 1, 10, 7
	return repo.SeedCase(scan.Case{
		FileID:         &fileID,
		ResourceID:     &resourceID,
		GameID:         &gameID,
		UploaderID:     member.UserID,
		ReviewDeadline: apitest.Now.Add(24 * time.Hour),
		Detector:       scan.Detector,
		Viruses:        []string{"Eicar"},
		ScanResult:     json.RawMessage(`{"isInfected":true}`),
		NotifyOnAllow:  true,
		FileName:       "a.7z",
		FileSize:       3,
		FileHash:       "h",
		Created:        apitest.Now,
		Updated:        apitest.Now,
	})
}

func TestMalwareCaseRoutes(t *testing.T) {
	e := setup(t)
	seedCase(e.repo)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/malware-scan-cases", As: &member}), http.StatusForbidden, 403)
	list := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/malware-scan-cases?status=PENDING&sortBy=review_deadline", As: &admin})
	e.server.Expect(list, http.StatusOK, 0)
	want := `{"items":[{"id":1,"status":"PENDING","decision_source":null,"review_note":null,"review_deadline":"2026-10-04T01:02:03.000Z","reviewed_at":null,"detector":"clamscan","detected_viruses":["Eicar"],"file_name":"a.7z","file_size":3,"file_hash":"h","hash_algorithm":null,"notify_uploader_on_allow":true,"uploader_notified_at":null,"created":"2026-10-03T01:02:03.000Z","updated":"2026-10-03T01:02:03.000Z","file":{"id":1,"file_status":2,"file_check_status":6,"is_virus_false_positive":false},"resource":null,"uploader":{"id":9,"name":"uploader","avatar":null,"is_sponsor":false},"reviewer":null}],"meta":{"totalItems":1,"itemCount":1,"itemsPerPage":10,"totalPages":1,"currentPage":1}}`
	if string(list.Data) != want {
		t.Fatalf("list\n got %s\nwant %s", list.Data, want)
	}
	detail := e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/malware-scan-cases/1", As: &admin})
	e.server.Expect(detail, http.StatusOK, 0)
	if !strings.Contains(string(detail.Data), `"scan_result":{"isInfected":true}`) || !strings.Contains(string(detail.Data), `"uploader":{"id":9,"name":"uploader","avatar":null,"is_sponsor":false,"role":0,"status":0}`) {
		t.Fatalf("detail %s", detail.Data)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodGet, Path: "/admin/content/malware-scan-cases/9", As: &admin}), http.StatusNotFound, 440206)
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/malware-scan-cases/1/review", As: &admin, Body: map[string]any{"decision": "KEEP"}}), http.StatusUnprocessableEntity, 100101)
	reviewed := e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/malware-scan-cases/1/review", As: &admin, Body: map[string]any{"decision": "ALLOW", "review_note": "fp", "notify_uploader": false}})
	e.server.Expect(reviewed, http.StatusOK, 0)
	if !strings.Contains(string(reviewed.Data), `"status":"RELEASED_FALSE_POSITIVE","decision_source":"ADMIN_ALLOW","review_note":"fp"`) || !strings.Contains(string(reviewed.Data), `"notify_uploader_on_allow":false,"uploader_notified_at":null`) {
		t.Fatalf("reviewed %s", reviewed.Data)
	}
	if jobs := e.events.Jobs(); len(jobs) != 1 {
		t.Fatalf("released files are queued for storage: %+v", jobs)
	}
	e.server.Expect(e.server.Do(apitest.Request{Method: http.MethodPatch, Path: "/admin/content/malware-scan-cases/1/review", As: &admin, Body: map[string]any{"decision": "DELETE"}}), http.StatusConflict, 440207)
}
