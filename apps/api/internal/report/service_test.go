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
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
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
	banner    *reporttest.Banner
	mailer    *reporttest.Mailer
	events    *downloadtest.Recorder
	service   *report.Service
}

func newFixture() fixture {
	f := fixture{
		repo:      reporttest.NewMemoryRepository(func() time.Time { return now }),
		resources: reporttest.NewResources(),
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
		Banner:    f.banner,
		Messages:  f.events,
		Mailer:    f.mailer,
		Queue:     f.events,
		Tx:        &txtest.Immediate{},
		Settings:  settingtest.Source{},
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
	raw, err := json.Marshal(msg.Meta)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
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
	if jobs := f.events.Jobs(); len(jobs) != 2 || jobs[0] != (report.AlertAdmins{ReportID: created.ID}) || jobs[1] != (report.MailAdmins{ReportID: created.ID}) {
		t.Fatalf("admins are messaged and mailed in the background, each by its own job: %+v", jobs)
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

func TestAdminsAreMessagedAndMailedSeparately(t *testing.T) {
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
	if len(f.mailer.Alerts) != 0 {
		t.Fatalf("messaging does not mail: %+v", f.mailer.Alerts)
	}
	f.mailer.Err = errors.New("mail provider down")
	if err := f.service.MailAdmins(ctx, created.ID); err == nil {
		t.Fatal("a refused mail fails its own job")
	}
	if len(f.events.Messages()) != 2 {
		t.Fatalf("a failed mail repeats no message: %+v", f.events.Messages())
	}
	f.mailer.Err = nil
	if err := f.service.MailAdmins(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	if len(f.mailer.Alerts) != 1 || f.mailer.Alerts[0].ReviewURL != "https://shionlib.example/admin/reports?id=1" || f.mailer.Alerts[0].GameTitle != "ゲーム" {
		t.Fatalf("mail %+v", f.mailer.Alerts)
	}
	for _, skipped := range []func(context.Context, int) error{f.service.AlertAdmins, f.service.MailAdmins} {
		if err := skipped(ctx, 999); err != nil {
			t.Fatalf("deleted reports are skipped: %v", err)
		}
	}
	f.repo.Admins = []report.Admin{{ID: 3}}
	if err := f.service.MailAdmins(ctx, created.ID); err != nil || len(f.mailer.Alerts) != 1 {
		t.Fatalf("admins without an address are not mailed: %v %+v", err, f.mailer.Alerts)
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
	if got := meta(t, messages[1]); got["ban_days"] != float64(30) || got["upload_tier_demoted"] != true || got["process_note"] != "confirmed" {
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
	if view.ReportedPenaltyApplied || len(f.banner.Bans) != 0 {
		t.Fatalf("admins are never penalized: %+v", view.Report)
	}
	if len(f.resources.TakenDown) != 0 || len(f.events.Messages()) != 0 {
		t.Fatal("no removal and no notifications")
	}
}

func TestReviewValidCountsAsAViolationFromMediumUp(t *testing.T) {
	ctx := context.Background()
	for _, tc := range []struct {
		level     report.Level
		violation bool
	}{
		{level: report.LevelLow},
		{level: report.LevelMedium, violation: true},
	} {
		f := newFixture()
		created := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonOther, Level: tc.level})
		view, err := f.service.Review(ctx, adminAct, created.ID, report.ReviewInput{Verdict: report.VerdictValid})
		if err != nil {
			t.Fatal(err)
		}
		if view.ReportedPenaltyApplied != tc.violation || len(f.banner.Bans) != 0 {
			t.Fatalf("%s: %+v %+v", tc.level, view.Report, f.banner.Bans)
		}
		messages := f.events.Messages()
		if got := meta(t, messages[1]); got["upload_tier_demoted"] != tc.violation || got["ban_days"] != float64(0) {
			t.Fatalf("%s: penalty meta %v", tc.level, got)
		}
	}
}

func TestReviewInvalidLadder(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		previous int
		banDays  int
	}{
		{previous: 0},
		{previous: 2},
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
		applied := tc.banDays > 0
		if view.Status != report.StatusInvalid || view.ReporterPenaltyApplied != applied {
			t.Fatalf("previous %d: %+v", tc.previous, view.Report)
		}
		if tc.banDays > 0 && (len(f.banner.Bans) != 1 || f.banner.Bans[0].Days != tc.banDays) {
			t.Fatalf("previous %d bans %+v", tc.previous, f.banner.Bans)
		}
		if !applied && len(f.banner.Bans) != 0 {
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

func TestADetailTellsWhatTheReporterFiledBefore(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusInvalid, Created: now.Add(-24 * time.Hour)})
	f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusInvalid, Created: now.Add(-40 * 24 * time.Hour)})
	f.repo.Seed(report.Report{ResourceID: 99, ReporterID: reporterID, Status: report.StatusValid, Created: now.Add(-24 * time.Hour)})
	f.repo.Seed(report.Report{ResourceID: 99, ReporterID: uploaderID, Status: report.StatusInvalid, Created: now.Add(-24 * time.Hour)})
	pending := f.repo.Seed(report.Report{ResourceID: resourceID, ReporterID: reporterID, ReportedUserID: uploaderID, Reason: report.ReasonOther, Level: report.LevelMedium, Created: now})

	detail, err := f.service.Get(ctx, pending.ID)
	if err != nil {
		t.Fatal(err)
	}
	if want := (report.ReporterRecord{Filed: 4, Invalid: 2, NextInvalid: 2}); detail.ReporterRecord != want {
		t.Fatalf("a pending report counts as the next invalid one within the window: %+v", detail.ReporterRecord)
	}
	reviewed, err := f.service.Review(ctx, adminAct, pending.ID, report.ReviewInput{Verdict: report.VerdictInvalid})
	if err != nil {
		t.Fatal(err)
	}
	if want := (report.ReporterRecord{Filed: 4, Invalid: 3, NextInvalid: 2}); reviewed.ReporterRecord != want {
		t.Fatalf("once dismissed it is among the invalid ones: %+v", reviewed.ReporterRecord)
	}
	if _, err := f.service.Get(ctx, 404); !errors.Is(err, report.ErrNotFound) {
		t.Fatalf("unexpected result for a missing report: %v", err)
	}
}

func TestThePolicyListsEveryLevelAndStep(t *testing.T) {
	f := newFixture()
	policy := f.service.Policy()
	if len(policy.Levels) != 4 || policy.FalseReportWindowDays != 30 || policy.ViolationFreeze != 30*24*time.Hour {
		t.Fatalf("unexpected policy %+v", policy)
	}
	for _, rule := range policy.Levels {
		if rule.Penalty != report.TargetPenalty(rule.Level) {
			t.Fatalf("level %s: %+v", rule.Level, rule.Penalty)
		}
		for _, reason := range rule.Reasons {
			if report.DefaultLevel(reason) != rule.Level {
				t.Fatalf("reason %s is not at level %s by default", reason, rule.Level)
			}
		}
	}
	critical := policy.Levels[3]
	if critical.Level != report.LevelCritical || len(critical.Reasons) != 1 || critical.Reasons[0] != report.ReasonMalware {
		t.Fatalf("levels come lowest first, each with the reasons that start there: %+v", critical)
	}
	for _, step := range policy.FalseReportSteps {
		if report.FalseReportPenalty(step.Count).BanDays != step.BanDays {
			t.Fatalf("step %+v", step)
		}
	}
	if len(policy.FalseReportSteps) != 2 || report.FalseReportPenalty(6) != (report.Penalty{}) {
		t.Fatalf("a count between the steps brings no penalty: %+v", policy.FalseReportSteps)
	}
}
