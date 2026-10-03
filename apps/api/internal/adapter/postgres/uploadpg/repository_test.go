package uploadpg_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	_ upload.Repository      = (*uploadpg.Repository)(nil)
	_ upload.QuotaRepository = (*uploadpg.QuotaRepository)(nil)
)

var base = time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)

func newSession(t *testing.T, repo *uploadpg.Repository, creator int, path string, expires time.Time) upload.Session {
	t.Helper()
	session, err := repo.CreateSession(context.Background(), upload.NewSession{
		FileName:    "game.7z",
		TotalSize:   100,
		ChunkSize:   40,
		TotalChunks: 3,
		FileHash:    "blake3hash",
		StoragePath: path,
		ExpiresAt:   expires,
		CreatorID:   creator,
	})
	if err != nil {
		t.Fatal(err)
	}
	return session
}

func newFile(t *testing.T, db *pgtest.DB, creator int, mutate func(*ent.GameDownloadResourceFileCreate)) *ent.GameDownloadResourceFile {
	t.Helper()
	ctx := context.Background()
	resource, err := db.Ent.GameDownloadResource.Create().SetGameID(db.Game(t)).SetCreatorID(creator).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	create := db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resource.ID).
		SetType(1).
		SetFileName("file.7z").
		SetFileSize(10).
		SetFileHash("hash").
		SetCreatorID(creator)
	if mutate != nil {
		mutate(create)
	}
	file, err := create.Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return file
}

func TestRepositoryContract(t *testing.T) {
	uploadtest.RepositoryContract(t, func(t *testing.T) uploadtest.Env {
		db := pgtest.New(t)
		return uploadtest.Env{
			Repo:    uploadpg.NewRepository(db.Ent),
			NewUser: db.User,
			AttachFile: func(t *testing.T, sessionID int, path string) {
				session, err := db.Ent.GameUploadSession.Get(context.Background(), sessionID)
				if err != nil {
					t.Fatal(err)
				}
				newFile(t, db, session.CreatorID, func(c *ent.GameDownloadResourceFileCreate) {
					c.SetUploadSessionID(sessionID).SetFilePath(path)
				})
			},
		}
	})
}

func TestSessionLifecycle(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewRepository(db.Ent)
	creator := db.User(t)

	session := newSession(t, repo, creator, "/spool/PENDING.sltf", base.Add(time.Hour))
	if session.ID == 0 || session.Status != upload.StatusUploading || session.HashAlgorithm != upload.HashBLAKE3 || session.FileHash != "blake3hash" || len(session.UploadedChunks) != 0 || session.ChunkSize != 40 || session.TotalChunks != 3 {
		t.Fatalf("unexpected created session %+v", session)
	}
	if err := repo.SetStoragePath(ctx, session.ID, "/spool/1.sltf"); err != nil {
		t.Fatal(err)
	}
	for _, index := range []int{2, 0, 2} {
		if err := repo.AddChunk(ctx, session.ID, index); err != nil {
			t.Fatal(err)
		}
	}
	got, err := repo.GetSession(ctx, session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.StoragePath != "/spool/1.sltf" || !slices.Equal(got.UploadedChunks, []int{2, 0}) {
		t.Fatalf("chunks must be recorded once each: %+v", got)
	}

	mime := "application/octet-stream"
	changed, err := repo.SetStatus(ctx, session.ID, upload.StatusUploading, upload.StatusCompleted, &mime)
	if err != nil || !changed {
		t.Fatalf("first transition: %v %v", changed, err)
	}
	changed, err = repo.SetStatus(ctx, session.ID, upload.StatusUploading, upload.StatusAborted, nil)
	if err != nil || changed {
		t.Fatalf("transition from a stale status must not apply: %v %v", changed, err)
	}
	got, _ = repo.GetSession(ctx, session.ID)
	if got.Status != upload.StatusCompleted || got.MimeType == nil || *got.MimeType != mime {
		t.Fatalf("unexpected completed session %+v", got)
	}

	err = postgres.NewTransactor(db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		locked, err := repo.LockSession(ctx, session.ID)
		if err != nil {
			return err
		}
		if locked.ID != session.ID {
			return fmt.Errorf("locked %d", locked.ID)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	for name, call := range map[string]func() error{
		"get":  func() error { _, err := repo.GetSession(ctx, 987654); return err },
		"lock": func() error { _, err := repo.LockSession(ctx, 987654); return err },
		"path": func() error { return repo.SetStoragePath(ctx, 987654, "x") },
	} {
		if err := call(); !errors.Is(err, upload.ErrSessionNotFound) {
			t.Fatalf("%s on a missing session: %v", name, err)
		}
	}
}

func TestListUploading(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewRepository(db.Ent)
	creator, other := db.User(t), db.User(t)

	active := newSession(t, repo, creator, "/spool/a.sltf", base.Add(time.Hour))
	second := newSession(t, repo, creator, "/spool/b.sltf", base.Add(2*time.Hour))
	newSession(t, repo, creator, "/spool/c.sltf", base.Add(-time.Minute))
	completed := newSession(t, repo, creator, "/spool/d.sltf", base.Add(time.Hour))
	if _, err := repo.SetStatus(ctx, completed.ID, upload.StatusUploading, upload.StatusCompleted, nil); err != nil {
		t.Fatal(err)
	}
	newSession(t, repo, other, "/spool/e.sltf", base.Add(time.Hour))

	sessions, err := repo.ListUploading(ctx, creator, base, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 2 || sessions[0].ID != active.ID || sessions[1].ID != second.ID {
		t.Fatalf("only the caller's unexpired uploading sessions are listed: %+v", sessions)
	}
	limited, _ := repo.ListUploading(ctx, creator, base, 1)
	if len(limited) != 1 {
		t.Fatalf("limit ignored: %+v", limited)
	}
}

func TestListStaleAndReferencedPaths(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewRepository(db.Ent)
	creator := db.User(t)
	now := time.Now().UTC()
	cutoff := now.Add(-6 * time.Hour)

	aborted := newSession(t, repo, creator, "/spool/aborted.sltf", now.Add(time.Hour))
	if _, err := repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted, nil); err != nil {
		t.Fatal(err)
	}
	expiredUpload := newSession(t, repo, creator, "/spool/old.sltf", cutoff.Add(-time.Minute))
	newSession(t, repo, creator, "/spool/fresh.sltf", cutoff.Add(time.Minute))
	orphanCompleted := newSession(t, repo, creator, "/spool/orphan.sltf", now.Add(time.Hour))
	attachedCompleted := newSession(t, repo, creator, "/spool/attached.sltf", now.Add(time.Hour))
	recentCompleted := newSession(t, repo, creator, "/spool/recent.sltf", now.Add(time.Hour))
	for _, id := range []int{orphanCompleted.ID, attachedCompleted.ID, recentCompleted.ID} {
		if err := db.Ent.GameUploadSession.UpdateOneID(id).SetStatus(gameuploadsession.StatusCOMPLETED).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range []int{orphanCompleted.ID, attachedCompleted.ID} {
		if err := db.Ent.GameUploadSession.UpdateOneID(id).SetUpdated(cutoff.Add(-time.Hour)).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	expired := newSession(t, repo, creator, "/spool/expired.sltf", cutoff.Add(-time.Hour))
	if err := db.Ent.GameUploadSession.UpdateOneID(expired.ID).SetStatus(gameuploadsession.StatusEXPIRED).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	newFile(t, db, creator, func(c *ent.GameDownloadResourceFileCreate) {
		c.SetUploadSessionID(attachedCompleted.ID).SetFilePath("/spool/file-only.sltf")
	})

	stale, err := repo.ListStale(ctx, cutoff, 10)
	if err != nil {
		t.Fatal(err)
	}
	var ids []int
	for _, session := range stale {
		ids = append(ids, session.ID)
	}
	if !slices.Equal(ids, []int{aborted.ID, expiredUpload.ID, orphanCompleted.ID}) {
		t.Fatalf("unexpected stale sessions %v", ids)
	}
	if limited, _ := repo.ListStale(ctx, cutoff, 1); len(limited) != 1 || limited[0].ID != aborted.ID {
		t.Fatalf("stale listing is bounded and ordered: %+v", limited)
	}

	if has, err := repo.HasFile(ctx, attachedCompleted.ID); err != nil || !has {
		t.Fatalf("attached session: %v %v", has, err)
	}
	if has, err := repo.HasFile(ctx, orphanCompleted.ID); err != nil || has {
		t.Fatalf("orphan session: %v %v", has, err)
	}

	referenced, err := repo.ReferencedPaths(ctx, []string{"/spool/fresh.sltf", "/spool/orphan.sltf", "/spool/aborted.sltf", "/spool/expired.sltf", "/spool/file-only.sltf", "/spool/unknown.sltf"})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{"/spool/fresh.sltf": true, "/spool/orphan.sltf": true, "/spool/file-only.sltf": true}
	if len(referenced) != len(want) {
		t.Fatalf("unexpected references %v", referenced)
	}
	for path := range want {
		if !referenced[path] {
			t.Fatalf("missing reference %s in %v", path, referenced)
		}
	}
	if empty, err := repo.ReferencedPaths(ctx, nil); err != nil || len(empty) != 0 {
		t.Fatalf("no candidates: %v %v", empty, err)
	}
}

func newQuota(t *testing.T, db *pgtest.DB, user int, size, used int64, firstGrant bool) *ent.UserUploadQuota {
	t.Helper()
	row, err := db.Ent.UserUploadQuota.Create().SetUserID(user).SetSize(size).SetUsed(used).SetIsFirstGrant(firstGrant).Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func TestQuotaLedger(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	sessions := uploadpg.NewRepository(db.Ent)
	repo := uploadpg.NewQuotaRepository(db.Ent)
	owner, stranger := db.User(t), db.User(t)
	row := newQuota(t, db, owner, 1000, 0, false)

	if _, found, err := repo.FindQuota(ctx, stranger); err != nil || found {
		t.Fatalf("missing quota: %v %v", found, err)
	}
	if _, err := repo.LockQuota(ctx, stranger); !errors.Is(err, upload.ErrQuotaNotFound) {
		t.Fatalf("lock missing quota: %v", err)
	}
	if err := repo.AddUsed(ctx, 987654, 1); !errors.Is(err, upload.ErrQuotaNotFound) {
		t.Fatalf("update missing quota: %v", err)
	}

	err := postgres.NewTransactor(db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		quota, err := repo.LockQuota(ctx, owner)
		if err != nil {
			return err
		}
		if err := repo.AddUsed(ctx, quota.ID, 300); err != nil {
			return err
		}
		if err := repo.AddSize(ctx, quota.ID, -100); err != nil {
			return err
		}
		return repo.MarkFirstGrant(ctx, quota.ID)
	})
	if err != nil {
		t.Fatal(err)
	}
	quota, found, err := repo.FindQuota(ctx, owner)
	if err != nil || !found || quota.ID != row.ID || quota.Size != 900 || quota.Used != 300 || !quota.IsFirstGrant || quota.UserID != owner {
		t.Fatalf("unexpected quota %+v %v %v", quota, found, err)
	}
	if err := repo.SetUsed(ctx, quota.ID, 0); err != nil {
		t.Fatal(err)
	}
	if quota, _, _ = repo.FindQuota(ctx, owner); quota.Used != 0 {
		t.Fatalf("used not reset: %+v", quota)
	}

	first := newSession(t, sessions, owner, "/spool/q1.sltf", base)
	second := newSession(t, sessions, owner, "/spool/q2.sltf", base)
	reason := "GAME_UPLOAD"
	for _, record := range []upload.NewQuotaRecord{
		{QuotaID: quota.ID, Field: upload.FieldUsed, Action: upload.ActionUse, Amount: 50, Reason: &reason, SessionID: &first.ID},
		{QuotaID: quota.ID, Field: upload.FieldSize, Action: upload.ActionAdd, Amount: 70, SessionID: &second.ID},
		{QuotaID: quota.ID, Field: upload.FieldSize, Action: upload.ActionSub, Amount: 5},
	} {
		if err := repo.AddRecord(ctx, record); err != nil {
			t.Fatal(err)
		}
	}
	record, found, err := repo.FindWithdrawable(ctx, owner, first.ID)
	if err != nil || !found || record.Amount != 50 || record.Action != upload.ActionUse || record.Field != upload.FieldUsed || record.QuotaID != quota.ID || record.Reason == nil || *record.Reason != reason || record.Withdrawn {
		t.Fatalf("unexpected withdrawable record %+v %v %v", record, found, err)
	}
	if _, found, _ := repo.FindWithdrawable(ctx, stranger, first.ID); found {
		t.Fatal("records of other users must not be withdrawn")
	}
	if _, found, _ := repo.FindWithdrawable(ctx, owner, second.ID); found {
		t.Fatal("size records are not withdrawable")
	}
	if err := repo.MarkWithdrawn(ctx, record.ID); err != nil {
		t.Fatal(err)
	}
	if _, found, _ := repo.FindWithdrawable(ctx, owner, first.ID); found {
		t.Fatal("withdrawn records are not withdrawable twice")
	}
	if err := repo.MarkWithdrawn(ctx, 987654); !errors.Is(err, upload.ErrQuotaRecordNotFound) {
		t.Fatalf("missing record: %v", err)
	}
}

func TestCountApprovedFiles(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewQuotaRepository(db.Ent)
	creator := db.User(t)
	since := time.Now().UTC().Add(-time.Hour)

	newFile(t, db, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFileCheckStatus(1) })
	newFile(t, db, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFileCheckStatus(1).SetCreated(since.Add(-time.Hour)) })
	newFile(t, db, creator, func(c *ent.GameDownloadResourceFileCreate) { c.SetFileCheckStatus(2) })
	newFile(t, db, db.User(t), func(c *ent.GameDownloadResourceFileCreate) { c.SetFileCheckStatus(1) })

	count, err := repo.CountApprovedFiles(ctx, creator, since)
	if err != nil || count != 1 {
		t.Fatalf("approved files since cutoff: %d %v", count, err)
	}
}

func TestUploaderQueries(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	repo := uploadpg.NewQuotaRepository(db.Ent)
	old := time.Now().UTC().AddDate(0, 0, -30)
	cutoff := time.Now().UTC().AddDate(0, 0, -7)

	user := func(created time.Time, role, status int) int {
		return configureUser(t, db, db.User(t), created, role, status)
	}
	candidate := user(old, 1, 1)
	newQuota(t, db, candidate, 0, 0, false)
	second := user(old, 1, 1)
	newQuota(t, db, second, 0, 0, false)
	recent := user(time.Now().UTC(), 1, 1)
	newQuota(t, db, recent, 0, 0, false)
	granted := user(old, 1, 1)
	newQuota(t, db, granted, 10, 0, true)
	admin := user(old, 2, 1)
	newQuota(t, db, admin, 0, 0, false)
	banned := user(old, 1, 2)
	newQuota(t, db, banned, 0, 0, false)
	user(old, 1, 1)

	ids, err := repo.GrantCandidates(ctx, cutoff, 0, 10)
	if err != nil || !slices.Equal(ids, []int{candidate, second}) {
		t.Fatalf("grant candidates: %v %v", ids, err)
	}
	if page, _ := repo.GrantCandidates(ctx, cutoff, candidate, 10); !slices.Equal(page, []int{second}) {
		t.Fatalf("keyset pagination: %v", page)
	}
	if page, _ := repo.GrantCandidates(ctx, cutoff, 0, 1); !slices.Equal(page, []int{candidate}) {
		t.Fatalf("limit: %v", page)
	}

	active, err := repo.ActiveUploaders(ctx, 0, 10)
	if err != nil || !slices.Equal(active, []int{candidate, second, recent, granted}) {
		t.Fatalf("active uploaders: %v %v", active, err)
	}

	if _, err := db.Ent.UserLoginSession.Create().
		SetUserID(second).
		SetRefreshTokenHash("hash").
		SetRefreshTokenPrefix("prefix").
		SetExpiresAt(time.Now().UTC().Add(time.Hour)).
		Save(ctx); err != nil {
		t.Fatal(err)
	}
	stale, err := db.Ent.UserLoginSession.Create().
		SetUserID(granted).
		SetRefreshTokenHash("hash2").
		SetRefreshTokenPrefix("prefix2").
		SetExpiresAt(time.Now().UTC().Add(time.Hour)).
		Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.SQL.ExecContext(ctx, `UPDATE user_login_sessions SET updated = $2 WHERE id = $1`, stale.ID, old); err != nil {
		t.Fatal(err)
	}
	inactive, err := repo.InactiveUploaders(ctx, cutoff, 0, 10)
	if err != nil || !slices.Equal(inactive, []int{candidate, recent, granted}) {
		t.Fatalf("inactive uploaders: %v %v", inactive, err)
	}
}

func configureUser(t *testing.T, db *pgtest.DB, id int, created time.Time, role, status int) int {
	t.Helper()
	ctx := context.Background()
	if err := db.Ent.User.UpdateOneID(id).SetRole(role).SetStatus(status).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := db.SQL.ExecContext(ctx, `UPDATE users SET created = $2 WHERE id = $1`, id, created); err != nil {
		t.Fatal(err)
	}
	return id
}
