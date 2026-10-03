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
	f.file(t, resource.ID, creator, nil)
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFilePath("/spool/2.sltf").SetFileCheckStatus(1) })
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFilePath("/spool/3.sltf").SetFileStatus(download.FileInObjectStore)
	})
	f.file(t, resource.ID, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFilePath("/spool/4.sltf").SetType(download.FileTypeDirectLink)
	})

	files, err := f.repo.ListPending(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 {
		t.Fatalf("only pending uploads with a local copy are scanned: %+v", files)
	}
	got := files[0]
	if got.ID != pending.ID || got.ResourceID != resource.ID || got.GameID != gameID || got.Path != "/spool/1.sltf" || got.Name != "game.7z" || got.Size != 123 || got.Hash != "digest" || got.HashAlgorithm != "blake3" || got.UploadSessionID == nil || *got.UploadSessionID != session.ID || got.CreatorID != creator || got.CheckStatus != download.CheckPending || got.Status != download.FileOnServer || got.Type != download.FileTypeObjectStore {
		t.Fatalf("unexpected pending file %+v", got)
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
	if files, _ := f.repo.ListPending(ctx, 10); len(files) != 0 {
		t.Fatalf("scanned files leave the queue: %+v", files)
	}
	if _, found, err := f.repo.LockFile(ctx, 987654); err != nil || found {
		t.Fatalf("missing file: %v %v", found, err)
	}
	if err := f.repo.SetCheckStatus(ctx, 987654, download.CheckOK, false); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("missing file update: %v", err)
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

	late := f.newCase(t, f.file(t, resource.ID, alice, nil), gameID, now.Add(-time.Hour))
	later := f.newCase(t, f.file(t, resource.ID, alice, nil), gameID, now.Add(-2*time.Hour))
	f.newCase(t, f.file(t, resource.ID, bob, nil), gameID, now.Add(time.Hour))
	done := f.newCase(t, f.file(t, resource.ID, bob, nil), gameID, now.Add(-3*time.Hour))
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
	if err != nil || total != 4 || len(all) != 4 || all[0].ID != done.ID || all[3].Uploader.ID != bob {
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
