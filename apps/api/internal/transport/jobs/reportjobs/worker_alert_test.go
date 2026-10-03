package reportjobs_test

import (
	"testing"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/report/reporttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/reportjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestAlertWorkerNotifiesTheAdmins(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	repo := reporttest.NewMemoryRepository(func() time.Time { return now })
	resources := reporttest.NewResources()
	resources.Items[1] = download.Resource{ID: 1, GameID: 7, Status: download.ResourceActive, CreatorID: 9}
	repo.GameOf[1] = 7
	repo.Games[7] = report.GameTitles{ID: 7, TitleJP: "ゲーム"}
	repo.AddMember(9, report.RoleUser, 1, "uploader")
	repo.AddMember(8, report.RoleUser, 1, "reporter")
	repo.Admins = []report.Admin{{ID: 2, Email: "admin@example.com"}}
	events := &downloadtest.Recorder{}
	mailer := &reporttest.Mailer{}
	service := report.NewService(report.Deps{
		Repo:      repo,
		Resources: resources,
		Quota:     &reporttest.Quota{Missing: map[int]bool{}},
		Banner:    &reporttest.Banner{},
		Messages:  events,
		Mailer:    mailer,
		Queue:     events,
		Tx:        &txtest.Immediate{},
		SiteURL:   "https://shionlib.example",
		Now:       func() time.Time { return now },
	})
	created := repo.Seed(report.Report{ResourceID: 1, ReporterID: 8, ReportedUserID: 9, Reason: report.ReasonMalware, Level: report.LevelCritical})
	reportjobs.Register(service)(river.NewWorkers())

	if err := reportjobs.NewAlertWorker(service).Work(t.Context(), &river.Job[report.AlertAdmins]{Args: report.AlertAdmins{ReportID: created.ID}}); err != nil {
		t.Fatal(err)
	}
	if messages := events.Messages(); len(messages) != 1 || messages[0].ReceiverID != 2 {
		t.Fatalf("admins are messaged: %+v", messages)
	}
	if len(mailer.Alerts) != 1 {
		t.Fatalf("admins are mailed: %+v", mailer.Alerts)
	}
}
