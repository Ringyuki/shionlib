package uploadtest

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Env struct {
	Repo       upload.Repository
	NewUser    func(t *testing.T) int
	AttachFile func(t *testing.T, sessionID int, path string)
}

func newSession(user int, path string, expires time.Time) upload.NewSession {
	return upload.NewSession{FileName: "game.7z", TotalSize: 10, ChunkSize: 4, TotalChunks: 3, FileHash: "hash", StoragePath: path, ExpiresAt: expires, CreatorID: user}
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	ctx := context.Background()
	later := time.Now().Add(24 * time.Hour)

	t.Run("sessions are created uploading and can be read back", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		created, err := env.Repo.CreateSession(ctx, newSession(user, "/spool/PENDING.part", later))
		if err != nil {
			t.Fatal(err)
		}
		if created.ID == 0 || created.Status != upload.StatusUploading || created.HashAlgorithm != upload.HashBLAKE3 || len(created.UploadedChunks) != 0 {
			t.Fatalf("unexpected session %+v", created)
		}
		if err := env.Repo.SetStoragePath(ctx, created.ID, "/spool/1.part"); err != nil {
			t.Fatal(err)
		}
		got, err := env.Repo.GetSession(ctx, created.ID)
		if err != nil || got.StoragePath != "/spool/1.part" || got.TotalSize != 10 || got.ChunkSize != 4 || got.TotalChunks != 3 || got.CreatorID != user || got.FileHash != "hash" {
			t.Fatalf("get: %+v %v", got, err)
		}
		locked, err := env.Repo.LockSession(ctx, created.ID)
		if err != nil || locked.ID != created.ID {
			t.Fatalf("lock: %+v %v", locked, err)
		}
		if _, err := env.Repo.GetSession(ctx, 987654); !errors.Is(err, upload.ErrSessionNotFound) {
			t.Fatalf("missing get: %v", err)
		}
		if _, err := env.Repo.LockSession(ctx, 987654); !errors.Is(err, upload.ErrSessionNotFound) {
			t.Fatalf("missing lock: %v", err)
		}
	})

	t.Run("chunks are recorded once in arrival order", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.CreateSession(ctx, newSession(env.NewUser(t), "/spool/a.part", later))
		for _, index := range []int{2, 0, 2} {
			if err := env.Repo.AddChunk(ctx, created.ID, index); err != nil {
				t.Fatal(err)
			}
		}
		got, _ := env.Repo.GetSession(ctx, created.ID)
		if !slices.Equal(got.UploadedChunks, []int{2, 0}) {
			t.Fatalf("chunks %v", got.UploadedChunks)
		}
	})

	t.Run("status changes only from the expected state", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.CreateSession(ctx, newSession(env.NewUser(t), "/spool/b.part", later))
		mime := upload.DefaultMimeType
		if changed, err := env.Repo.SetStatus(ctx, created.ID, upload.StatusCompleted, upload.StatusExpired, nil); err != nil || changed {
			t.Fatalf("wrong source state must not change: %v %v", changed, err)
		}
		if changed, err := env.Repo.SetStatus(ctx, created.ID, upload.StatusUploading, upload.StatusCompleted, &mime); err != nil || !changed {
			t.Fatalf("complete: %v %v", changed, err)
		}
		got, _ := env.Repo.GetSession(ctx, created.ID)
		if got.Status != upload.StatusCompleted || got.MimeType == nil || *got.MimeType != mime {
			t.Fatalf("after complete %+v", got)
		}
		if changed, err := env.Repo.SetStatus(ctx, 987654, upload.StatusUploading, upload.StatusAborted, nil); err != nil || changed {
			t.Fatalf("missing session: %v %v", changed, err)
		}
	})

	t.Run("ongoing lists only live uploads of the creator", func(t *testing.T) {
		env := newEnv(t)
		user, other := env.NewUser(t), env.NewUser(t)
		first, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c1.part", later))
		second, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c2.part", later))
		_, _ = env.Repo.CreateSession(ctx, newSession(user, "/spool/c3.part", time.Now().Add(-time.Minute)))
		done, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c4.part", later))
		_, _ = env.Repo.SetStatus(ctx, done.ID, upload.StatusUploading, upload.StatusAborted, nil)
		_, _ = env.Repo.CreateSession(ctx, newSession(other, "/spool/c5.part", later))
		got, err := env.Repo.ListUploading(ctx, user, time.Now(), 10)
		if err != nil || len(got) != 2 || got[0].ID != first.ID || got[1].ID != second.ID {
			t.Fatalf("ongoing %+v %v", got, err)
		}
		limited, _ := env.Repo.ListUploading(ctx, user, time.Now(), 1)
		if len(limited) != 1 {
			t.Fatalf("limit ignored: %+v", limited)
		}
	})

	t.Run("stale sessions and referenced paths", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		aborted, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s1.part", later))
		_, _ = env.Repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted, nil)
		expiredUpload, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s2.part", time.Now().Add(-48*time.Hour)))
		live, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s3.part", later))
		orphanCompleted, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s4.part", later))
		_, _ = env.Repo.SetStatus(ctx, orphanCompleted.ID, upload.StatusUploading, upload.StatusCompleted, nil)
		attached, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s5.part", later))
		_, _ = env.Repo.SetStatus(ctx, attached.ID, upload.StatusUploading, upload.StatusCompleted, nil)
		env.AttachFile(t, attached.ID, "/spool/s5.part")
		finished, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s6.part", time.Now().Add(-48*time.Hour)))
		_, _ = env.Repo.SetStatus(ctx, finished.ID, upload.StatusUploading, upload.StatusExpired, nil)

		stale, err := env.Repo.ListStale(ctx, time.Now().Add(time.Hour), 10)
		if err != nil {
			t.Fatal(err)
		}
		var ids []int
		for _, session := range stale {
			ids = append(ids, session.ID)
		}
		if !slices.Equal(ids, []int{aborted.ID, expiredUpload.ID, orphanCompleted.ID}) {
			t.Fatalf("stale ids %v (live %d attached %d expired %d)", ids, live.ID, attached.ID, finished.ID)
		}
		recent, _ := env.Repo.ListStale(ctx, time.Now().Add(-time.Hour), 10)
		for _, session := range recent {
			if session.ID == orphanCompleted.ID {
				t.Fatal("recently completed sessions are not stale yet")
			}
		}
		if has, err := env.Repo.HasFile(ctx, attached.ID); err != nil || !has {
			t.Fatalf("has file: %v %v", has, err)
		}
		if has, _ := env.Repo.HasFile(ctx, orphanCompleted.ID); has {
			t.Fatal("orphan session has no file")
		}
		refs, err := env.Repo.ReferencedPaths(ctx, []string{"/spool/s1.part", "/spool/s3.part", "/spool/s4.part", "/spool/s5.part", "/spool/s6.part", "/spool/none.part"})
		if err != nil {
			t.Fatal(err)
		}
		if refs["/spool/s1.part"] || !refs["/spool/s3.part"] || !refs["/spool/s4.part"] || !refs["/spool/s5.part"] || refs["/spool/s6.part"] || refs["/spool/none.part"] {
			t.Fatalf("referenced paths %v", refs)
		}
	})
}
