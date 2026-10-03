package report_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/report/reporttest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	uploaderID = 10
	reporterID = 20
	resourceID = 5
	gameID     = 7
)

var (
	now         = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	reporterAct = actor.Actor{UserID: reporterID, Role: actor.RoleUser}
	uploaderAct = actor.Actor{UserID: uploaderID, Role: actor.RoleUser}
	adminAct    = actor.Actor{UserID: 2, Role: actor.RoleAdmin}
)

type fixture struct {
	repo      *reporttest.MemoryRepository
	resources *reporttest.Resources
	quota     *reporttest.Quota
	banner    *reporttest.Banner
	mailer    *reporttest.Mailer
	events    *downloadtest.Recorder
	service   *report.Service
}

func newFixture() fixture {
	f := fixture{
		repo:      reporttest.NewMemoryRepository(func() time.Time { return now }),
		resources: reporttest.NewResources(),
		quota:     &reporttest.Quota{Missing: map[int]bool{}},
		banner:    &reporttest.Banner{},
		mailer:    &reporttest.Mailer{},
		events:    &downloadtest.Recorder{},
	}
	f.resources.Items[resourceID] = download.Resource{ID: resourceID, GameID: gameID, Status: download.ResourceActive, CreatorID: uploaderID}
	f.resources.Keys[resourceID] = []string{"games/7/1/a.7z"}
	f.repo.GameOf[resourceID] = gameID
	f.repo.Games[gameID] = report.GameTitles{ID: gameID, TitleJP: "ゲーム"}
	f.repo.AddMember(uploaderID, report.RoleUser, 1, "uploader")
	f.repo.AddMember(reporterID, report.RoleUser, 1, "reporter")
	f.repo.AddMember(adminAct.UserID, 2, 1, "admin")
	f.service = report.NewService(report.Deps{
		Repo:      f.repo,
		Resources: f.resources,
		Quota:     f.quota,
		Banner:    f.banner,
		Messages:  f.events,
		Mailer:    f.mailer,
		Queue:     f.events,
		Tx:        &txtest.Immediate{},
		SiteURL:   "https://shionlib.example",
		Now:       func() time.Time { return now },
	})
	return f
}

func ptr[T any](v T) *T {
	return &v
}

func expectCode(t *testing.T, err error, want apperror.Definition) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Fatalf("got %v, want %s", err, want.Name())
	}
}

func meta(t *testing.T, msg message.NewMessage) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(msg.Meta, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestCreateValidationOrder(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.resources.Items[6] = download.Resource{ID: 6, Status: download.ResourceRemoved, CreatorID: uploaderID}
	in := report.CreateInput{Reason: report.ReasonBrokenLink}

	_, err := f.service.Create(ctx, reporterAct, 404, in)
	expectCode(t, err, download.ErrResourceNotFound)
	_, err = f.service.Create(ctx, reporterAct, 6, in)
	expectCode(t, err, download.ErrResourceNotFound)
	_, err = f.service.Create(ctx, uploaderAct, resourceID, in)
	expectCode(t, err, report.ErrSelfReport)

	created, err := f.service.Create(ctx, reporterAct, resourceID, report.CreateInput{Reason: report.ReasonMisleadingContent, Detail: ptr("fake")})
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != report.StatusPending || created.Level != report.LevelHigh || created.ReportedUserID != uploaderID {
		t.Fatalf("created %+v", created)
	}
	if jobs := f.events.Jobs(); len(jobs) != 1 || jobs[0] != (report.AlertAdmins{ReportID: created.ID}) {
		t.Fatalf("admins are alerted in the background: %+v", jobs)
	}
	_, err = f.service.Create(ctx, reporterAct, resourceID, in)
	expectCode(t, err, report.ErrDuplicated)

	other := actor.Actor{UserID: 30, Role: actor.RoleUser}
	for range report.SuspendThreshold {
		f.repo.Seed(report.Report{ResourceID: 99, ReporterID: other.UserID, Status: report.StatusInvalid, Created: now.Add(-time.Hour)})
	}
	_, err = f.service.Create(ctx, other, resourceID, in)
	expectCode(t, err, report.ErrSuspended)
}

func TestDefaultLevels(t *testing.T) {
	cases := map[report.Reason]report.Level{
		report.ReasonMalware:           report.LevelCritical,
		report.ReasonIrrelevant:        report.LevelMedium,
		report.ReasonBrokenLink:        report.LevelLow,
		report.ReasonMisleadingContent: report.LevelHigh,
		report.ReasonOther:             report.LevelMedium,
	}
	for reason, want := range cases {
		if got := report.DefaultLevel(reason); got != want {
			t.Fatalf("%s: %s", reason, got)
		}
	}
}

func TestAlertAdminsSendsMessagesAndMail(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonMalware, Level: report.LevelCritical})
	f.repo.Admins = []report.Admin{{ID: 2, Email: "admin@example.com"}, {ID: 3}}
	if err := f.service.AlertAdmins(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	messages := f.events.Messages()
	if len(messages) != 2 || *messages[0].LinkURL != "/admin/reports?id=1" || *messages[0].GameID != gameID {
		t.Fatalf("messages %+v", messages)
	}
	if got := meta(t, messages[0]); got["reporter_name"] != "reporter" || got["reported_user_name"] != "uploader" || got["malicious_level"] != "CRITICAL" {
		t.Fatalf("meta %v", got)
	}
	if len(f.mailer.Alerts) != 1 || f.mailer.Alerts[0].ReviewURL != "https://shionlib.example/admin/reports?id=1" || f.mailer.Alerts[0].GameTitle != "ゲーム" {
		t.Fatalf("mail %+v", f.mailer.Alerts)
	}
	if err := f.service.AlertAdmins(ctx, 999); err != nil {
		t.Fatalf("deleted reports are skipped: %v", err)
	}
}

func TestReviewValidMalwarePunishesUploaderAndTakesDownTheResource(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonMalware, Level: report.LevelLow})
	view, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictValid, Level: ptr(report.LevelLow), Note: ptr("confirmed")})
	if err != nil {
		t.Fatalf("plain admins can confirm a report with removal: %v", err)
	}
	if view.Status != report.StatusValid || view.Level != report.LevelCritical || !view.ReportedPenaltyApplied || *view.ProcessedBy != adminAct.UserID || *view.ProcessNote != "confirmed" {
		t.Fatalf("reviewed %+v", view.Report)
	}
	if !slices.Equal(f.quota.Adjustments, []reporttest.Adjustment{{UserID: uploaderID, Action: upload.ActionSub, Amount: 5 * report.GiB, Reason: "REPORT_MALWARE"}}) {
		t.Fatalf("quota %+v", f.quota.Adjustments)
	}
	if !slices.Equal(f.banner.Bans, []reporttest.Ban{{UserID: uploaderID, Reason: "Resource report: MALWARE", Days: 30}}) {
		t.Fatalf("ban %+v", f.banner.Bans)
	}
	if !slices.Equal(f.resources.TakenDown, []int{resourceID}) || len(f.resources.Purged) != 1 {
		t.Fatalf("take down %v purge %v", f.resources.TakenDown, f.resources.Purged)
	}
	messages := f.events.Messages()
	if len(messages) != 2 || messages[0].ReceiverID != reporterID || messages[0].Tone != message.ToneSuccess || messages[1].ReceiverID != uploaderID || messages[1].Tone != message.ToneDestructive {
		t.Fatalf("messages %+v", messages)
	}
	if got := meta(t, messages[1]); got["ban_days"] != float64(30) || got["quota_sub_gb"] != float64(5) || got["process_note"] != "confirmed" {
		t.Fatalf("penalty meta %v", got)
	}
	_, err = f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictInvalid})
	expectCode(t, err, report.ErrAlreadyProcessed)
	_, err = f.service.Review(ctx, adminAct, 999, report.ReviewInput{Verdict: report.VerdictInvalid})
	expectCode(t, err, report.ErrNotFound)
}

func TestReviewValidKeepsTheResourceWhenAsked(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.repo.AddMember(uploaderID, 2, 1, "uploader")
	created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonBrokenLink, Level: report.LevelHigh})
	view, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictValid, RemoveResource: ptr(false), Notify: ptr(false)})
	if err != nil {
		t.Fatal(err)
	}
	if view.ReportedPenaltyApplied || len(f.quota.Adjustments) != 0 || len(f.banner.Bans) != 0 {
		t.Fatalf("admins are never penalized: %+v", view.Report)
	}
	if len(f.resources.TakenDown) != 0 || len(f.events.Messages()) != 0 {
		t.Fatal("no removal and no notifications")
	}
}

func TestReviewValidFailsWithoutQuotaRow(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quota.Missing[uploaderID] = true
	created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonOther, Level: report.LevelMedium})
	_, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictValid})
	expectCode(t, err, upload.ErrQuotaNotFound)
}

func TestReviewInvalidLadder(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		previous int
		quota    int64
		banDays  int
	}{
		{previous: 0},
		{previous: 2, quota: report.GiB},
		{previous: 4, banDays: 3},
		{previous: 7, banDays: 14},
		{previous: 8},
	}
	for _, tc := range cases {
		f := newFixture()
		for range tc.previous {
			f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusInvalid, Created: now.Add(-24 * time.Hour)})
		}
		f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusInvalid, Created: now.Add(-40 * 24 * time.Hour)})
		created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonOther, Level: report.LevelMedium})
		view, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictInvalid})
		if err != nil {
			t.Fatal(err)
		}
		applied := tc.quota > 0 || tc.banDays > 0
		if view.Status != report.StatusInvalid || view.ReporterPenaltyApplied != applied {
			t.Fatalf("previous %d: %+v", tc.previous, view.Report)
		}
		if tc.quota > 0 && (len(f.quota.Adjustments) != 1 || f.quota.Adjustments[0].Reason != "REPORT_FALSE_POSITIVE") {
			t.Fatalf("previous %d quota %+v", tc.previous, f.quota.Adjustments)
		}
		if tc.banDays > 0 && (len(f.banner.Bans) != 1 || f.banner.Bans[0].Days != tc.banDays) {
			t.Fatalf("previous %d bans %+v", tc.previous, f.banner.Bans)
		}
		if !applied && (len(f.quota.Adjustments) != 0 || len(f.banner.Bans) != 0) {
			t.Fatalf("previous %d unexpected penalty", tc.previous)
		}
		messages := f.events.Messages()
		if len(messages) != 1 || messages[0].ReceiverID != reporterID || meta(t, messages[0])["false_report_count"] != float64(tc.previous+1) {
			t.Fatalf("previous %d message %+v", tc.previous, messages)
		}
		if len(f.resources.TakenDown) != 0 {
			t.Fatal("invalid reports never remove resources")
		}
	}
}

func TestReviewInvalidSkipsBannedReporters(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.repo.AddMember(reporterID, report.RoleUser, report.UserBanned, "reporter")
	for range 4 {
		f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusInvalid, Created: now})
	}
	created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonOther, Level: report.LevelMedium})
	view, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictInvalid})
	if err != nil || view.ReporterPenaltyApplied || len(f.banner.Bans) != 0 {
		t.Fatalf("already banned reporters are not banned again: %+v %v", view.Report, err)
	}
}
