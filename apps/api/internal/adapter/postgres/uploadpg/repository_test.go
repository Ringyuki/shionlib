package uploadpg_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var _ upload.Repository = (*uploadpg.Repository)(nil)

var base = time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)

func newSession(t *testing.T, repo *uploadpg.Repository, creator int, path string, expires time.Time) upload.Session {
	t.Helper()
	session, err := repo.CreateSession(context.Background(), upload.NewSession{
		FileName:    "game.7z",
		TotalSize:   100,
		ChunkSize:   40,
		TotalChunks: 3,
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
	if session.ID == 0 || session.Status != upload.StatusUploading || session.HashAlgorithm != upload.HashBLAKE3 || session.FileHash != "" || len(session.UploadedChunks) != 0 || session.ChunkSize != 40 || session.TotalChunks != 3 {
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
	changed, err := repo.Complete(ctx, session.ID, "blake3hash", mime)
	if err != nil || !changed {
		t.Fatalf("first transition: %v %v", changed, err)
	}
	changed, err = repo.SetStatus(ctx, session.ID, upload.StatusUploading, upload.StatusAborted)
	if err != nil || changed {
		t.Fatalf("transition from a stale status must not apply: %v %v", changed, err)
	}
	got, _ = repo.GetSession(ctx, session.ID)
	if got.Status != upload.StatusCompleted || got.FileHash != "blake3hash" || got.MimeType == nil || *got.MimeType != mime {
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
	if _, err := repo.Complete(ctx, completed.ID, "hash", upload.DefaultMimeType); err != nil {
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
	if _, err := repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted); err != nil {
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

func TestAdmissionLockKeepsConcurrentInitsWithinTheInFlightLimit(t *testing.T) {
	ctx := context.Background()
	db := pgtest.New(t)
	uploader := actor.Actor{UserID: db.User(t), Role: actor.RoleUser}
	settings := settingtest.Source{}
	settingtest.Set(settings, upload.InFlightLimit, 300)
	settingtest.Set(settings, upload.SpoolReserve, 0)
	quota := upload.NewQuotaService(uploadpg.NewQuotaRepository(db.Ent), settings, time.Now)
	service := upload.NewService(uploadpg.NewRepository(db.Ent), quota, uploadtest.NewMemorySpool(), postgres.NewTransactor(db.Ent), settings, time.Now)
	var admitted, refused atomic.Int32
	var group errgroup.Group
	for range 8 {
		group.Go(func() error {
			_, err := service.Init(ctx, uploader, upload.InitInput{FileName: "game.7z", TotalSize: 100})
			switch {
			case err == nil:
				admitted.Add(1)
			case errors.Is(err, upload.ErrInFlightExceeded):
				refused.Add(1)
			default:
				return err
			}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		t.Fatal(err)
	}
	if admitted.Load() != 3 || refused.Load() != 5 {
		t.Fatalf("admitted %d refused %d", admitted.Load(), refused.Load())
	}
}
