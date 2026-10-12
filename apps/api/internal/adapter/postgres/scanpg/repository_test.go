package scanpg_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/scanpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.Repository = (*scanpg.Repository)(nil)

type fixture struct {
	db   *pgtest.DB
	repo *scanpg.Repository
}

func newFixture(t *testing.T) fixture {
	db := pgtest.New(t)
	return fixture{db: db, repo: scanpg.NewRepository(db.Ent)}
}

func ptr[T any](v T) *T {
	return &v
}

func (f fixture) resource(t *testing.T, gameID, creator int) *ent.GameDownloadResource {
	t.Helper()
	row, err := f.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(creator).SetNote("resource note").Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func (f fixture) file(t *testing.T, resourceID, creator int, mutate func(*ent.GameDownloadResourceFileCreate)) *ent.GameDownloadResourceFile {
	t.Helper()
	create := f.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resourceID).
		SetType(download.FileTypeObjectStore).
		SetFileName("game.7z").
		SetFileSize(123).
		SetFileHash("digest").
		SetHashAlgorithm("blake3").
		SetFileStatus(download.FileOnServer).
		SetCreatorID(creator)
	if mutate != nil {
		mutate(create)
	}
	row, err := create.Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func (f fixture) newCase(t *testing.T, file *ent.GameDownloadResourceFile, gameID int, deadline time.Time) scan.Case {
	t.Helper()
	created, err := f.repo.CreateCase(context.Background(), scan.NewCase{
		FileID:         file.ID,
		ResourceID:     file.GameDownloadResourceID,
		GameID:         gameID,
		UploaderID:     file.CreatorID,
		ReviewDeadline: deadline,
		Viruses:        []string{"Eicar-Test-Signature"},
		ScanResult:     json.RawMessage(`{"file":"/spool/x","isInfected":true,"viruses":["Eicar-Test-Signature"]}`),
		ScanLogPath:    ptr("/var/log/scan.log"),
		ScanLogExcerpt: ptr("stream: Eicar FOUND"),
		FileName:       file.FileName,
		FileSize:       file.FileSize,
		FileHash:       file.FileHash,
		HashAlgorithm:  "blake3",
	})
	if err != nil {
		t.Fatal(err)
	}
	return created
}

func TestPendingFiles(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	resource := f.resource(t, gameID, creator)
	session, err := f.db.Ent.GameUploadSession.Create().
		SetFileName("game.7z").SetTotalSize(1).SetChunkSize(1).SetTotalChunks(1).SetFileSha256("h").
		SetStatus("COMPLETED").SetStoragePath("/spool/1.sltf").SetExpiresAt(time.Now().UTC()).SetCreatorID(creator).
		Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	pending := f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFilePath("/spool/1.sltf").SetUploadSessionID(session.ID)
	})
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFileName("no-copy.7z") })
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileName("approved.7z").SetFilePath("/spool/2.sltf").SetFileCheckStatus(1)
	})
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileName("stored.7z").SetFilePath("/spool/3.sltf").SetFileStatus(download.FileInObjectStore)
	})
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileName("link").SetFilePath("/spool/4.sltf").SetType(download.FileTypeDirectLink)
	})

	ids, err := f.repo.PendingResources(ctx, time.Now())
	if err != nil || !slices.Equal(ids, []int{resource.ID}) {
		t.Fatalf("resources with pending uploads that have a local copy: %v %v", ids, err)
	}
	all, err := f.repo.ResourceFiles(ctx, resource.ID)
	if err != nil || len(all) != 5 || all[0].ID != pending.ID || all[2].CheckStatus != download.CheckOK || all[3].Status != download.FileInObjectStore || all[0].GameID != gameID {
		t.Fatalf("every file of the resource, oldest first: %+v %v", all, err)
	}
	got := all[0]
	if got.ID != pending.ID || got.ResourceID != resource.ID || got.GameID != gameID || got.Path != "/spool/1.sltf" || got.Name != "game.7z" || got.Size != 123 || got.Hash != "digest" || got.HashAlgorithm != "blake3" || got.UploadSessionID == nil || *got.UploadSessionID != session.ID || got.CreatorID != creator || got.CheckStatus != download.CheckPending || got.Status != download.FileOnServer || got.Type != download.FileTypeObjectStore || got.Created.IsZero() {
		t.Fatalf("unexpected pending file %+v", got)
	}
	if none, err := f.repo.ResourceFiles(ctx, 987654); err != nil || len(none) != 0 {
		t.Fatalf("a missing resource has no files: %+v %v", none, err)
	}

	err = postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		locked, found, err := f.repo.LockFile(ctx, pending.ID)
		if err != nil {
			return err
		}
		if !found || locked.ID != pending.ID || locked.GameID != gameID {
			return fmt.Errorf("unexpected lock %+v %v", locked, found)
		}
		return f.repo.SetCheckStatus(ctx, pending.ID, download.CheckHarmfulPendingReview, true)
	})
	if err != nil {
		t.Fatal(err)
	}
	row, _ := f.db.Ent.GameDownloadResourceFile.Get(ctx, pending.ID)
	if row.FileCheckStatus != int(download.CheckHarmfulPendingReview) || !row.IsVirusFalsePositive {
		t.Fatalf("check status not stored: %+v", row)
	}
	if ids, _ := f.repo.PendingResources(ctx, time.Now()); len(ids) != 0 {
		t.Fatalf("scanned files leave the queue: %v", ids)
	}
	if _, found, err := f.repo.LockFile(ctx, 987654); err != nil || found {
		t.Fatalf("missing file: %v %v", found, err)
	}
	if err := f.repo.SetCheckStatus(ctx, 987654, download.CheckOK, false); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("missing file update: %v", err)
	}

	record := f.db.Ent.Inspection.Create().SetResourceID(resource.ID).SetStatus("ready").SaveX(ctx)
	if err := f.repo.SetInspection(ctx, pending.ID, record.ID, "0f3a"); err != nil {
		t.Fatal(err)
	}
	row, _ = f.db.Ent.GameDownloadResourceFile.Get(ctx, pending.ID)
	if row.InspectionID == nil || *row.InspectionID != record.ID || row.FileSha256 == nil || *row.FileSha256 != "0f3a" {
		t.Fatalf("inspection not attached: %+v", row)
	}
	if again, _ := f.repo.ResourceFiles(ctx, resource.ID); again[0].InspectionID == nil || *again[0].InspectionID != record.ID || again[1].InspectionID != nil {
		t.Fatalf("a pending file tells which inspection it has: %+v", again[:2])
	}
	other := f.db.Ent.Inspection.Create().SetResourceID(resource.ID).SetStatus("failed").SaveX(ctx)
	if err := f.repo.SetInspection(ctx, pending.ID, other.ID, ""); err != nil {
		t.Fatal(err)
	}
	row, _ = f.db.Ent.GameDownloadResourceFile.Get(ctx, pending.ID)
	if *row.InspectionID != other.ID || row.FileSha256 == nil || *row.FileSha256 != "0f3a" {
		t.Fatalf("an inspection without a digest leaves the digest alone: %+v", row)
	}
	if err := f.repo.SetInspection(ctx, 987654, record.ID, "0f3a"); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("missing file: %v", err)
	}
	if err := f.repo.SetInspection(ctx, pending.ID, 987654, "0f3a"); !errors.Is(err, inspection.ErrNotFound) {
		t.Fatalf("missing inspection: %v", err)
	}
}

func TestPendingResourcesSkipRemovedAndDelayedResources(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator, gameID := f.db.User(t), f.db.Game(t)
	live, removed, delayed := f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator)
	for _, resource := range []*ent.GameDownloadResource{live, removed, delayed} {
		f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFilePath(fmt.Sprintf("/spool/%d.sltf", resource.ID)) })
	}
	f.db.Ent.GameDownloadResource.UpdateOneID(removed.ID).SetStatus(download.ResourceRemoved).ExecX(ctx)
	now := time.Now()
	if err := f.repo.DelayCheck(ctx, delayed.ID, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if ids, err := f.repo.PendingResources(ctx, now); err != nil || !slices.Equal(ids, []int{live.ID}) {
		t.Fatalf("removed and delayed resources wait: %v %v", ids, err)
	}
	if ids, _ := f.repo.PendingResources(ctx, now.Add(2*time.Hour)); !slices.Equal(ids, []int{live.ID, delayed.ID}) {
		t.Fatalf("a delayed resource is due again after its retry time: %v", ids)
	}
}

func TestAFailingCheckIsCountedStalledAndResumed(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator, gameID := f.db.User(t), f.db.Game(t)
	resource := f.resource(t, gameID, creator)
	first := f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFilePath("/spool/1.sltf") })
	second := f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFilePath("/spool/2.sltf").SetFileName("other.7z")
	})
	if err := f.repo.RecordCheckFailure(ctx, first.ID, scan.CheckFailure{Failures: 2, Reason: "clamd is down"}); err != nil {
		t.Fatal(err)
	}
	counted, _, err := f.repo.LockFile(ctx, first.ID)
	if err != nil || counted.CheckFailures != 2 || counted.CheckStatus != download.CheckPending || counted.StalledAt != nil {
		t.Fatalf("a failure is counted and the file keeps waiting: %+v %v", counted, err)
	}
	if row := f.db.Ent.GameDownloadResourceFile.GetX(ctx, first.ID); row.CheckError == nil || *row.CheckError != "clamd is down" {
		t.Fatalf("the reason is kept: %+v", row.CheckError)
	}
	early, late := time.Date(2026, 10, 1, 8, 0, 0, 0, time.UTC), time.Date(2026, 10, 5, 8, 0, 0, 0, time.UTC)
	for file, at := range map[int]time.Time{first.ID: early, second.ID: late} {
		if err := f.repo.RecordCheckFailure(ctx, file, scan.CheckFailure{Failures: 6, Reason: "still down", StalledAt: &at}); err != nil {
			t.Fatal(err)
		}
	}
	if ids, err := f.repo.PendingResources(ctx, time.Now()); err != nil || len(ids) != 0 {
		t.Fatalf("a stalled check is not picked up by itself: %v %v", ids, err)
	}
	all, err := f.repo.StalledFiles(ctx, nil, 0)
	if err != nil || len(all) != 2 || all[0].ID != first.ID || all[0].CheckFailures != 6 || all[0].StalledAt == nil || !all[0].StalledAt.Equal(early) || all[0].GameID != gameID {
		t.Fatalf("unexpected stalled files %+v %v", all, err)
	}
	between := early.Add(24 * time.Hour)
	if overdue, err := f.repo.StalledFiles(ctx, &between, 0); err != nil || len(overdue) != 1 || overdue[0].ID != first.ID {
		t.Fatalf("only the checks stalled before the given time: %+v %v", overdue, err)
	}
	if one, err := f.repo.StalledFiles(ctx, nil, 1); err != nil || len(one) != 1 {
		t.Fatalf("the limit applies: %+v %v", one, err)
	}
	entries, err := f.repo.StalledEntries(ctx, 10)
	if err != nil || len(entries) != 2 {
		t.Fatalf("unexpected stalled entries %+v %v", entries, err)
	}
	oldest := entries[0]
	if oldest.File.ID != first.ID || oldest.Reason != "still down" || oldest.File.CheckFailures != 6 || oldest.Game.ID != gameID || oldest.Uploader.ID != creator || oldest.Uploader.Name == "" {
		t.Fatalf("an entry names what failed, the game and the uploader, the longest waiting first: %+v", oldest)
	}
	if limited, err := f.repo.StalledEntries(ctx, 1); err != nil || len(limited) != 1 {
		t.Fatalf("the limit applies to entries: %+v %v", limited, err)
	}
	if err := f.repo.ResumeCheck(ctx, first.ID); err != nil {
		t.Fatal(err)
	}
	row := f.db.Ent.GameDownloadResourceFile.GetX(ctx, first.ID)
	if row.FileCheckStatus != int(download.CheckPending) || row.CheckFailures != 0 || row.CheckError != nil || row.CheckStalledAt != nil {
		t.Fatalf("a resumed check starts over: %+v", row)
	}
	if ids, _ := f.repo.PendingResources(ctx, time.Now()); !slices.Equal(ids, []int{resource.ID}) {
		t.Fatalf("the resource is due again: %v", ids)
	}
	if err := f.repo.RecordCheckFailure(ctx, 0, scan.CheckFailure{Failures: 1}); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("unexpected result for a missing file: %v", err)
	}
	if err := f.repo.ResumeCheck(ctx, 0); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("unexpected result for a missing file: %v", err)
	}
}

func TestCaseLifecycle(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	uploader, reviewer := f.db.User(t), f.db.User(t)
	gameID := f.db.Game(t, func(c *ent.GameCreate) { c.SetTitleZh("中文").SetTitleEn("English") })
	resource := f.resource(t, gameID, uploader)
	file := f.file(t, resource.ID, uploader, func(c *ent.GameDownloadResourceFileCreate) { c.SetFilePath("/spool/x.sltf") })
	deadline := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	created := f.newCase(t, file, gameID, deadline)
	if created.ID == 0 || created.Status != scan.CasePending || created.Detector != scan.Detector || !created.ReviewDeadline.Equal(deadline) || !slices.Equal(created.Viruses, []string{"Eicar-Test-Signature"}) || created.HashAlgorithm == nil || *created.HashAlgorithm != "blake3" || !created.NotifyOnAllow || created.FileSize != 123 || created.GameID == nil || *created.GameID != gameID {
		t.Fatalf("unexpected case %+v", created)
	}
	var result map[string]any
	if err := json.Unmarshal(created.ScanResult, &result); err != nil || result["isInfected"] != true {
		t.Fatalf("scan result: %s %v", created.ScanResult, err)
	}

	err := postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := f.repo.LockCase(ctx, created.ID)
		if err != nil {
			return err
		}
		if target.File == nil || target.File.ID != file.ID || target.File.Name != "game.7z" || target.File.Size != 123 || target.File.Path == nil || *target.File.Path != "/spool/x.sltf" || target.ResourceGameID == nil || *target.ResourceGameID != gameID {
			return fmt.Errorf("unexpected target %+v", target)
		}
		now := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
		return f.repo.ResolveCase(ctx, created.ID, scan.Resolution{
			Status:        scan.CaseReleased,
			Source:        scan.SourceAdminAllow,
			ReviewedBy:    &reviewer,
			ReviewedAt:    now,
			Note:          ptr("false positive"),
			NotifyOnAllow: ptr(false),
			NotifiedAt:    &now,
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	view, err := f.repo.GetCase(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != scan.CaseReleased || view.DecisionSource == nil || *view.DecisionSource != scan.SourceAdminAllow || view.NotifyOnAllow || view.UploaderNotifiedAt == nil || view.ReviewNote == nil || *view.ReviewNote != "false positive" || view.ReviewedBy == nil || *view.ReviewedBy != reviewer {
		t.Fatalf("resolution not stored: %+v", view.Case)
	}
	if view.File == nil || view.File.ID != file.ID || view.File.CreatorID != uploader || view.File.Status != download.FileOnServer {
		t.Fatalf("view file: %+v", view.File)
	}
	if view.Resource == nil || view.Resource.ID != resource.ID || view.Resource.GameID != gameID || view.Resource.Note == nil || view.Resource.Game.TitleZH != "中文" || view.Resource.Game.TitleEN != "English" {
		t.Fatalf("view resource: %+v", view.Resource)
	}
	if view.Uploader.ID != uploader || view.Uploader.Name == "" || view.Uploader.Role != 1 || view.Uploader.Status != 1 || view.Reviewer == nil || view.Reviewer.ID != reviewer {
		t.Fatalf("view people: %+v %+v", view.Uploader, view.Reviewer)
	}

	err = f.repo.ResolveCase(ctx, created.ID, scan.Resolution{Status: scan.CaseDeleted, Source: scan.SourceTimeoutAutoDelete, ReviewedAt: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	if err := f.db.Ent.GameDownloadResourceFile.DeleteOneID(file.ID).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	target, err := f.repo.LockCase(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if target.File != nil || target.FileID != nil || target.ReviewedBy != nil || target.ReviewNote != nil || target.UploaderNotifiedAt != nil || target.NotifyOnAllow {
		t.Fatalf("file removal nulls the reference and resolution clears optional fields: %+v", target)
	}
	if _, err := f.repo.LockCase(ctx, 987654); !errors.Is(err, scan.ErrCaseNotFound) {
		t.Fatalf("missing case lock: %v", err)
	}
	if _, err := f.repo.GetCase(ctx, 987654); !errors.Is(err, scan.ErrCaseNotFound) {
		t.Fatalf("missing case get: %v", err)
	}
	if err := f.repo.ResolveCase(ctx, 987654, scan.Resolution{Status: scan.CaseDeleted, Source: scan.SourceAdminDelete}); !errors.Is(err, scan.ErrCaseNotFound) {
		t.Fatalf("missing case resolve: %v", err)
	}
}

func TestExpiredAndListedCases(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice, bob, reviewer := f.db.User(t), f.db.User(t), f.db.User(t)
	gameID := f.db.Game(t)
	resource := f.resource(t, gameID, alice)
	now := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	named := func(name string) func(*ent.GameDownloadResourceFileCreate) {
		return func(c *ent.GameDownloadResourceFileCreate) { c.SetFileName(name) }
	}
	late := f.newCase(t, f.file(t, resource.ID, alice, named("late.7z")), gameID, now.Add(-time.Hour))
	later := f.newCase(t, f.file(t, resource.ID, alice, named("later.7z")), gameID, now.Add(-2*time.Hour))
	f.newCase(t, f.file(t, resource.ID, bob, named("future.7z")), gameID, now.Add(time.Hour))
	done := f.newCase(t, f.file(t, resource.ID, bob, named("done.7z")), gameID, now.Add(-3*time.Hour))
	f.newCase(t, f.file(t, resource.ID, bob, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileName("published.7z").SetFileStatus(download.FileInObjectStore).SetS3FileKey("games/published.7z")
	}), gameID, now.Add(-4*time.Hour))
	if err := f.repo.ResolveCase(ctx, done.ID, scan.Resolution{Status: scan.CaseDeleted, Source: scan.SourceAdminDelete, ReviewedBy: &reviewer, ReviewedAt: now}); err != nil {
		t.Fatal(err)
	}

	ids, err := f.repo.ExpiredCases(ctx, now, 10)
	if err != nil || !slices.Equal(ids, []int{later.ID, late.ID}) {
		t.Fatalf("expired pending cases by deadline: %v %v", ids, err)
	}
	if ids, _ := f.repo.ExpiredCases(ctx, now, 1); !slices.Equal(ids, []int{later.ID}) {
		t.Fatalf("limit: %v", ids)
	}

	all, total, err := f.repo.ListCases(ctx, scan.ListFilter{SortBy: "review_deadline"}, scan.Page{Number: 1, Size: 10})
	if err != nil || total != 5 || len(all) != 5 || all[1].ID != done.ID || all[4].Uploader.ID != bob {
		t.Fatalf("ascending deadline order: %d %+v %v", total, all, err)
	}
	pending := scan.CasePending
	mine, total, err := f.repo.ListCases(ctx, scan.ListFilter{Status: &pending, UploaderID: alice, SortBy: "id", Descending: true}, scan.Page{Number: 1, Size: 1})
	if err != nil || total != 2 || len(mine) != 1 || mine[0].ID != later.ID {
		t.Fatalf("filtered and paged: %d %+v %v", total, mine, err)
	}
	source := scan.SourceAdminDelete
	reviewed, total, err := f.repo.ListCases(ctx, scan.ListFilter{Source: &source, ReviewerID: reviewer, ResourceID: resource.ID, FileID: *done.FileID, SortBy: "unknown"}, scan.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(reviewed) != 1 || reviewed[0].ID != done.ID || reviewed[0].Reviewer == nil || reviewed[0].Reviewer.ID != reviewer {
		t.Fatalf("reviewer filter: %d %+v %v", total, reviewed, err)
	}
	decided, total, err := f.repo.ListCases(ctx, scan.ListFilter{Reviewed: true, SortBy: "id"}, scan.Page{Number: 1, Size: 10})
	if err != nil || total != len(decided) || total == 0 || total == 5 {
		t.Fatalf("decided cases: %d %+v %v", total, decided, err)
	}
	for _, item := range decided {
		if item.Status == scan.CasePending {
			t.Fatalf("a pending case among the decided ones: %+v", item)
		}
	}
}

func TestUsersAndGames(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	user := f.db.User(t)
	admin, superAdmin, bannedAdmin := f.db.User(t), f.db.User(t), f.db.User(t)
	for id, values := range map[int][2]int{admin: {2, 1}, superAdmin: {3, 1}, bannedAdmin: {2, 2}} {
		if err := f.db.Ent.User.UpdateOneID(id).SetRole(values[0]).SetStatus(values[1]).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	admins, err := f.repo.ActiveAdmins(ctx)
	if err != nil || len(admins) != 2 || admins[0].ID != admin || admins[1].ID != superAdmin || admins[0].Email == "" || admins[0].Name == "" {
		t.Fatalf("active admins: %+v %v", admins, err)
	}

	for want := 1; want <= 2; want++ {
		strikes, err := f.repo.AddStrike(ctx, user)
		if err != nil || strikes != want {
			t.Fatalf("strike %d: %d %v", want, strikes, err)
		}
	}
	if _, err := f.repo.AddStrike(ctx, 987654); err == nil {
		t.Fatal("strikes for a missing user must fail")
	}

	name, found, err := f.repo.UserName(ctx, user)
	if err != nil || !found || name == "" {
		t.Fatalf("user name: %q %v %v", name, found, err)
	}
	if _, found, _ := f.repo.UserName(ctx, 987654); found {
		t.Fatal("missing user name")
	}
	gameID := f.db.Game(t, func(c *ent.GameCreate) { c.SetTitleJp("日本語").SetTitleEn("EN") })
	titles, found, err := f.repo.GameTitles(ctx, gameID)
	if err != nil || !found || titles.ID != gameID || titles.TitleJP != "日本語" || titles.TitleEN != "EN" || titles.TitleZH != "" {
		t.Fatalf("game titles: %+v %v %v", titles, found, err)
	}
	if _, found, _ := f.repo.GameTitles(ctx, 987654); found {
		t.Fatal("missing game titles")
	}
}

func TestNextUninspectedTakesPublishedFilesByDownloads(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator, gameID := f.db.User(t), f.db.Game(t)
	stored := func(name string) func(*ent.GameDownloadResourceFileCreate) {
		return func(c *ent.GameDownloadResourceFileCreate) {
			c.SetFileName(name).SetFileStatus(download.FileInObjectStore).SetFileCheckStatus(int(download.CheckOK)).SetS3FileKey("games/" + name)
		}
	}
	quiet, popular, known, waiting, held, removed := f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator), f.resource(t, gameID, creator)
	f.db.Ent.GameDownloadResource.UpdateOneID(popular.ID).SetDownloads(571).ExecX(ctx)
	f.db.Ent.GameDownloadResource.UpdateOneID(removed.ID).SetStatus(download.ResourceRemoved).ExecX(ctx)
	f.file(t, quiet.ID, creator, stored("quiet.7z"))
	kept := f.file(t, popular.ID, creator, stored("popular.7z"))
	record := f.db.Ent.Inspection.Create().SetResourceID(known.ID).SetStatus("ready").SaveX(ctx)
	f.file(t, known.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { stored("known.7z")(c); c.SetInspectionID(record.ID) })
	f.file(t, waiting.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFileName("waiting.7z").SetFilePath("/spool/w.sltf") })
	f.file(t, held.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		stored("held.7z")(c)
		c.SetFileCheckStatus(int(download.CheckHarmfulPendingReview))
	})
	f.file(t, removed.ID, creator, stored("removed.7z"))

	first, found, err := f.repo.NextUninspected(ctx, nil)
	if err != nil || !found || first != popular.ID {
		t.Fatalf("the most downloaded resource comes first: %d %v %v", first, found, err)
	}
	second, found, err := f.repo.NextUninspected(ctx, []int{popular.ID})
	if err != nil || !found || second != quiet.ID {
		t.Fatalf("a skipped resource is left out: %d %v %v", second, found, err)
	}
	if _, found, err := f.repo.NextUninspected(ctx, []int{popular.ID, quiet.ID}); err != nil || found {
		t.Fatalf("inspected, unpublished, held and removed files are not taken: %v %v", found, err)
	}
	files, err := f.repo.ResourceFiles(ctx, popular.ID)
	if err != nil || len(files) != 1 || files[0].ID != kept.ID || files[0].StorageKey != "games/popular.7z" {
		t.Fatalf("a published file tells where it is stored: %+v %v", files, err)
	}
}
