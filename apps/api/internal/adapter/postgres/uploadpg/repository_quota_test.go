package uploadpg_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcereport"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/malwarescancase"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var _ upload.QuotaRepository = (*uploadpg.QuotaRepository)(nil)

func newResource(t *testing.T, db *pgtest.DB, creator int, mutate func(*ent.GameDownloadResourceCreate)) int {
	t.Helper()
	create := db.Ent.GameDownloadResource.Create().SetGameID(db.Game(t)).SetCreatorID(creator).SetPublishedAt(base)
	if mutate != nil {
		mutate(create)
	}
	return create.SaveX(context.Background()).ID
}

func newMalwareCase(t *testing.T, db *pgtest.DB, uploader int, status malwarescancase.Status, source malwarescancase.DecisionSource, reviewed time.Time) {
	t.Helper()
	db.Ent.MalwareScanCase.Create().
		SetUploaderID(uploader).
		SetStatus(status).
		SetDecisionSource(source).
		SetReviewedAt(reviewed).
		SetReviewDeadline(reviewed).
		SetDetector("clamav").
		SetFileName("game.exe").
		SetFileSize(1).
		SetFileHash("hash").
		SaveX(context.Background())
}

func newReport(t *testing.T, db *pgtest.DB, reported int, status gamedownloadresourcereport.Status, level gamedownloadresourcereport.MaliciousLevel, processed time.Time) {
	t.Helper()
	db.Ent.GameDownloadResourceReport.Create().
		SetResourceID(newResource(t, db, reported, nil)).
		SetReporterID(db.User(t)).
		SetReportedUserID(reported).
		SetReason(gamedownloadresourcereport.ReasonMALWARE).
		SetMaliciousLevel(level).
		SetStatus(status).
		SetProcessedAt(processed).
		SaveX(context.Background())
}

func TestStandingCountsPublishedResourcesTrustAndViolations(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewQuotaRepository(db.Ent)
	uploader := db.User(t)

	standing, err := repo.Standing(ctx, uploader)
	if err != nil || standing != (upload.Standing{Role: actor.RoleUser}) {
		t.Fatalf("fresh uploader %+v %v", standing, err)
	}

	newResource(t, db, uploader, nil)
	newResource(t, db, uploader, nil)
	newResource(t, db, uploader, func(c *ent.GameDownloadResourceCreate) { c.Mutation().ClearPublishedAt() })
	newResource(t, db, uploader, func(c *ent.GameDownloadResourceCreate) { c.SetStatus(download.ResourceRemoved) })
	newResource(t, db, db.User(t), nil)
	if err := repo.SetTrusted(ctx, uploader, true); err != nil {
		t.Fatal(err)
	}
	if standing, err = repo.Standing(ctx, uploader); err != nil || standing.Approved != 2 || !standing.Trusted || standing.LastViolation != nil {
		t.Fatalf("published resources and trust %+v %v", standing, err)
	}

	malware := base.Add(time.Hour)
	report := base.Add(2 * time.Hour)
	newMalwareCase(t, db, uploader, malwarescancase.StatusDELETED, malwarescancase.DecisionSourceADMIN_DELETE, malware)
	newMalwareCase(t, db, uploader, malwarescancase.StatusDELETED, malwarescancase.DecisionSourceTIMEOUT_AUTO_DELETE, base.Add(5*time.Hour))
	newMalwareCase(t, db, uploader, malwarescancase.StatusRELEASED_FALSE_POSITIVE, malwarescancase.DecisionSourceADMIN_ALLOW, base.Add(5*time.Hour))
	if standing, _ = repo.Standing(ctx, uploader); standing.LastViolation == nil || !standing.LastViolation.Equal(malware) {
		t.Fatalf("confirmed malware is a violation %+v", standing.LastViolation)
	}
	newReport(t, db, uploader, gamedownloadresourcereport.StatusVALID, gamedownloadresourcereport.MaliciousLevelMEDIUM, report)
	newReport(t, db, uploader, gamedownloadresourcereport.StatusVALID, gamedownloadresourcereport.MaliciousLevelLOW, base.Add(5*time.Hour))
	newReport(t, db, uploader, gamedownloadresourcereport.StatusINVALID, gamedownloadresourcereport.MaliciousLevelHIGH, base.Add(5*time.Hour))
	if standing, _ = repo.Standing(ctx, uploader); standing.LastViolation == nil || !standing.LastViolation.Equal(report) {
		t.Fatalf("the latest valid report from medium up is the last violation %+v", standing.LastViolation)
	}

	if err := repo.SetTrusted(ctx, uploader, false); err != nil {
		t.Fatal(err)
	}
	if standing, _ = repo.Standing(ctx, uploader); standing.Trusted {
		t.Fatalf("trust withdrawn %+v", standing)
	}
	if _, err := repo.Standing(ctx, 987654); err == nil {
		t.Fatal("unknown users have no standing")
	}
}

func TestStoredBytesCountStoredFilesOfActiveResources(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewQuotaRepository(db.Ent)
	uploader := db.User(t)
	files := 0
	addFile := func(creator, resource, fileType int, size int64) {
		files++
		db.Ent.GameDownloadResourceFile.Create().
			SetGameDownloadResourceID(resource).
			SetType(fileType).
			SetFileName(fmt.Sprintf("file-%d.7z", files)).
			SetFileSize(size).
			SetFileHash("hash").
			SetCreatorID(creator).
			SaveX(ctx)
	}

	active := newResource(t, db, uploader, nil)
	pending := newResource(t, db, uploader, func(c *ent.GameDownloadResourceCreate) { c.Mutation().ClearPublishedAt() })
	removed := newResource(t, db, uploader, func(c *ent.GameDownloadResourceCreate) { c.SetStatus(download.ResourceRemoved) })
	addFile(uploader, active, download.FileTypeObjectStore, 100)
	addFile(uploader, active, download.FileTypeObjectStore, 20)
	addFile(uploader, pending, download.FileTypeObjectStore, 3)
	addFile(uploader, active, download.FileTypeObjectStore+1, 1000)
	addFile(uploader, removed, download.FileTypeObjectStore, 1000)
	addFile(db.User(t), active, download.FileTypeObjectStore, 1000)

	sessions := uploadpg.NewRepository(db.Ent)
	finished := newSession(t, sessions, uploader, "/spool/finished.sltf", time.Now().Add(time.Hour))
	db.Ent.GameUploadSession.UpdateOneID(finished.ID).SetStatus(gameuploadsession.StatusCOMPLETED).ExecX(ctx)
	stored, err := repo.StoredBytes(ctx, uploader)
	if err != nil || stored != 123+finished.TotalSize {
		t.Fatalf("stored bytes count files and finished uploads not yet in a resource: %d %v", stored, err)
	}
	if none, err := repo.StoredBytes(ctx, db.User(t)); err != nil || none != 0 {
		t.Fatalf("users without files store nothing: %d %v", none, err)
	}
}

func TestInFlightBytesCountUploadsInProgress(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewRepository(db.Ent)
	quotas := uploadpg.NewQuotaRepository(db.Ent)
	uploader := db.User(t)
	now := time.Now().UTC()
	complete := func(id int) {
		db.Ent.GameUploadSession.UpdateOneID(id).SetStatus(gameuploadsession.StatusCOMPLETED).ExecX(ctx)
	}

	newSession(t, repo, uploader, "/spool/live.sltf", now.Add(time.Hour))
	newSession(t, repo, uploader, "/spool/expired.sltf", now.Add(-time.Minute))
	aborted := newSession(t, repo, uploader, "/spool/aborted.sltf", now.Add(time.Hour))
	if _, err := repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted); err != nil {
		t.Fatal(err)
	}
	unattached := newSession(t, repo, uploader, "/spool/unattached.sltf", now.Add(-time.Hour))
	complete(unattached.ID)
	attached := newSession(t, repo, uploader, "/spool/attached.sltf", now.Add(time.Hour))
	complete(attached.ID)
	newFile(t, db, uploader, func(c *ent.GameDownloadResourceFileCreate) { c.SetUploadSessionID(attached.ID) })
	newSession(t, repo, db.User(t), "/spool/other.sltf", now.Add(time.Hour))

	inFlight, err := quotas.InFlightBytes(ctx, uploader, now)
	if err != nil || inFlight != 100 {
		t.Fatalf("in-flight bytes %d %v", inFlight, err)
	}
}
