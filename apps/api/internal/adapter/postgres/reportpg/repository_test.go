package reportpg_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/reportpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var _ report.Repository = (*reportpg.Repository)(nil)

type fixture struct {
	db   *pgtest.DB
	repo *reportpg.Repository
}

func newFixture(t *testing.T) fixture {
	db := pgtest.New(t)
	return fixture{db: db, repo: reportpg.NewRepository(db.Ent)}
}

func ptr[T any](v T) *T {
	return &v
}

func (f fixture) resource(t *testing.T, gameID, creator, files int) *ent.GameDownloadResource {
	t.Helper()
	ctx := context.Background()
	row, err := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(creator).SetNote("note").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for i := range files {
		err := f.db.Ent.GameDownloadResourceFile.Create().
			SetGameDownloadResourceID(row.ID).
			SetType(download.FileTypeObjectStore).
			SetFileName(fmt.Sprintf("part%d.7z", i)).
			SetFileSize(int64(1000 + i)).
			SetFileHash(fmt.Sprintf("h%d", i)).
			SetHashAlgorithm("blake3").
			SetFileStatus(download.FileInObjectStore).
			SetFileCheckStatus(1).
			SetCreatorID(creator).
			Exec(ctx)
		if err != nil {
			t.Fatal(err)
		}
	}
	return row
}

func (f fixture) report(t *testing.T, resource *ent.GameDownloadResource, reporter int, reason report.Reason) report.Report {
	t.Helper()
	created, err := f.repo.Create(context.Background(), report.NewReport{
		ResourceID:     resource.ID,
		ReporterID:     reporter,
		ReportedUserID: resource.CreatorID,
		Reason:         reason,
		Detail:         ptr("details"),
		Level:          report.DefaultLevel(reason),
	})
	if err != nil {
		t.Fatal(err)
	}
	return created
}

func TestReportLifecycle(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	uploader, reporter, admin := f.db.User(t), f.db.User(t), f.db.User(t)
	gameID := f.db.Game(t, func(c *ent.GameCreate) { c.SetTitleZh("游戏") })
	resource := f.resource(t, gameID, uploader, 7)

	created := f.report(t, resource, reporter, report.ReasonMalware)
	if created.ID == 0 || created.Status != report.StatusPending || created.Level != report.LevelCritical || created.Reason != report.ReasonMalware || created.ReportedUserID != uploader || created.Detail == nil || *created.Detail != "details" {
		t.Fatalf("unexpected report %+v", created)
	}
	if _, err := f.repo.Create(ctx, report.NewReport{ResourceID: 987654, ReporterID: reporter, ReportedUserID: uploader, Reason: report.ReasonOther, Level: report.LevelMedium}); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("report on missing resource: %v", err)
	}
	if pending, err := f.repo.HasPending(ctx, resource.ID, reporter); err != nil || !pending {
		t.Fatalf("pending: %v %v", pending, err)
	}
	if pending, _ := f.repo.HasPending(ctx, resource.ID, admin); pending {
		t.Fatal("pending reports are per reporter")
	}

	processedAt := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	err := postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		locked, err := f.repo.Lock(ctx, created.ID)
		if err != nil {
			return err
		}
		if locked.ID != created.ID {
			return fmt.Errorf("locked %d", locked.ID)
		}
		if err := f.repo.Resolve(ctx, created.ID, report.Resolution{Status: report.StatusValid, Level: report.LevelHigh, ProcessedBy: admin, ProcessedAt: processedAt, Note: ptr("confirmed")}); err != nil {
			return err
		}
		if err := f.repo.MarkReportedPenalty(ctx, created.ID, true); err != nil {
			return err
		}
		return f.repo.MarkReporterPenalty(ctx, created.ID, true)
	})
	if err != nil {
		t.Fatal(err)
	}
	if pending, _ := f.repo.HasPending(ctx, resource.ID, reporter); pending {
		t.Fatal("resolved reports are no longer pending")
	}

	view, err := f.repo.Get(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != report.StatusValid || view.Level != report.LevelHigh || view.ProcessedBy == nil || *view.ProcessedBy != admin || view.ProcessedAt == nil || !view.ProcessedAt.Equal(processedAt) || view.ProcessNote == nil || *view.ProcessNote != "confirmed" || !view.ReportedPenaltyApplied || !view.ReporterPenaltyApplied {
		t.Fatalf("resolution: %+v", view.Report)
	}
	if view.Resource.ID != resource.ID || view.Resource.GameID != gameID || view.Resource.Note == nil || view.Resource.Game.TitleZH != "游戏" || len(view.Resource.Files) != 7 {
		t.Fatalf("detail resource: %+v", view.Resource)
	}
	if file := view.Resource.Files[6]; file.Name != "part6.7z" || file.Size != 1006 || file.Status != download.FileInObjectStore || file.CheckStatus != 1 || file.HashAlgorithm != upload.HashBLAKE3 || file.Hash != "h6" {
		t.Fatalf("detail file: %+v", file)
	}
	if view.Reporter.ID != reporter || view.Reporter.Role != 1 || view.Reporter.Status != 1 || view.ReportedUser.ID != uploader || view.Processor == nil || view.Processor.ID != admin {
		t.Fatalf("detail people: %+v %+v %+v", view.Reporter, view.ReportedUser, view.Processor)
	}

	if err := f.repo.Resolve(ctx, created.ID, report.Resolution{Status: report.StatusInvalid, Level: report.LevelLow, ProcessedBy: admin, ProcessedAt: processedAt}); err != nil {
		t.Fatal(err)
	}
	if view, _ = f.repo.Get(ctx, created.ID); view.ProcessNote != nil {
		t.Fatalf("an omitted note is cleared: %+v", view.Report)
	}
	for name, call := range map[string]func() error{
		"lock": func() error { _, err := f.repo.Lock(ctx, 987654); return err },
		"get":  func() error { _, err := f.repo.Get(ctx, 987654); return err },
		"resolve": func() error {
			return f.repo.Resolve(ctx, 987654, report.Resolution{Status: report.StatusValid, Level: report.LevelLow, ProcessedBy: admin})
		},
		"reported": func() error { return f.repo.MarkReportedPenalty(ctx, 987654, true) },
		"reporter": func() error { return f.repo.MarkReporterPenalty(ctx, 987654, true) },
	} {
		if err := call(); !errors.Is(err, report.ErrNotFound) {
			t.Fatalf("%s on a missing report: %v", name, err)
		}
	}
}

func TestCountInvalidSince(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	uploader, reporter, other := f.db.User(t), f.db.User(t), f.db.User(t)
	resource := f.resource(t, f.db.Game(t), uploader, 0)
	since := time.Now().UTC().Add(-30 * 24 * time.Hour)
	resolve := func(id int, status report.Status) {
		if err := f.repo.Resolve(ctx, id, report.Resolution{Status: status, Level: report.LevelLow, ProcessedBy: other, ProcessedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	resolve(f.report(t, resource, reporter, report.ReasonOther).ID, report.StatusInvalid)
	resolve(f.report(t, resource, reporter, report.ReasonOther).ID, report.StatusInvalid)
	resolve(f.report(t, resource, reporter, report.ReasonOther).ID, report.StatusValid)
	old := f.report(t, resource, reporter, report.ReasonOther)
	resolve(old.ID, report.StatusInvalid)
	if _, err := f.db.SQL.ExecContext(ctx, `UPDATE game_download_resource_reports SET created = $2 WHERE id = $1`, old.ID, since.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	resolve(f.report(t, resource, other, report.ReasonOther).ID, report.StatusInvalid)
	f.report(t, resource, reporter, report.ReasonOther)

	count, err := f.repo.CountInvalidSince(ctx, reporter, since)
	if err != nil || count != 2 {
		t.Fatalf("invalid reports in window: %d %v", count, err)
	}
}

func TestListFiltersAndSorts(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	uploader, alice, bob, admin := f.db.User(t), f.db.User(t), f.db.User(t), f.db.User(t)
	big := f.resource(t, f.db.Game(t), uploader, 7)
	small := f.resource(t, f.db.Game(t), uploader, 1)

	first := f.report(t, big, alice, report.ReasonMalware)
	second := f.report(t, small, bob, report.ReasonBrokenLink)
	third := f.report(t, big, bob, report.ReasonIrrelevant)
	if err := f.repo.Resolve(ctx, second.ID, report.Resolution{Status: report.StatusInvalid, Level: report.LevelLow, ProcessedBy: admin, ProcessedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	all, total, err := f.repo.List(ctx, report.ListFilter{SortBy: "id"}, report.Page{Number: 1, Size: 10})
	if err != nil || total != 3 || len(all) != 3 || all[0].ID != first.ID || all[2].ID != third.ID {
		t.Fatalf("ascending ids: %d %+v %v", total, all, err)
	}
	if len(all[0].Resource.Files) != 5 || all[0].Resource.Files[0].Name != "part0.7z" || all[0].Resource.Files[4].Name != "part4.7z" {
		t.Fatalf("list shows at most five files in id order: %+v", all[0].Resource.Files)
	}
	if all[1].Processor == nil || all[1].Processor.ID != admin || all[0].Processor != nil {
		t.Fatalf("processor summaries: %+v %+v", all[0].Processor, all[1].Processor)
	}

	pending := report.StatusPending
	page, total, err := f.repo.List(ctx, report.ListFilter{Status: &pending, Descending: true, SortBy: "bogus"}, report.Page{Number: 1, Size: 1})
	if err != nil || total != 2 || len(page) != 1 || page[0].ID != third.ID {
		t.Fatalf("pending newest first: %d %+v %v", total, page, err)
	}
	reason := report.ReasonMalware
	level := report.LevelCritical
	filtered, total, err := f.repo.List(ctx, report.ListFilter{Reason: &reason, Level: &level, ResourceID: big.ID, ReporterID: alice, ReportedUserID: uploader}, report.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(filtered) != 1 || filtered[0].ID != first.ID {
		t.Fatalf("combined filters: %d %+v %v", total, filtered, err)
	}
}

func TestMembersAndAdmins(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	user, admin, suspended := f.db.User(t), f.db.User(t), f.db.User(t)
	if err := f.db.Ent.User.UpdateOneID(admin).SetRole(2).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.db.Ent.User.UpdateOneID(suspended).SetRole(3).SetStatus(2).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	member, found, err := f.repo.Member(ctx, suspended)
	if err != nil || !found || member.ID != suspended || member.Role != 3 || member.Status != 2 || member.Name == "" {
		t.Fatalf("member: %+v %v %v", member, found, err)
	}
	if _, found, _ := f.repo.Member(ctx, 987654); found {
		t.Fatal("missing member")
	}
	admins, err := f.repo.ActiveAdmins(ctx)
	if err != nil || len(admins) != 1 || admins[0].ID != admin {
		t.Fatalf("admins: %+v %v (user %d)", admins, err, user)
	}
}
