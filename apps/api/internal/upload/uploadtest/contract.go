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
	return upload.NewSession{FileName: "game.7z", TotalSize: 10, ChunkSize: 4, TotalChunks: 3, StoragePath: path, ExpiresAt: expires, CreatorID: user}
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
		if err != nil || got.StoragePath != "/spool/1.part" || got.TotalSize != 10 || got.ChunkSize != 4 || got.TotalChunks != 3 || got.CreatorID != user || got.FileHash != "" {
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

	t.Run("chunks are recorded once in arrival order and extend the session", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.CreateSession(ctx, newSession(env.NewUser(t), "/spool/a.part", later))
		extended := later.Add(time.Hour).Truncate(time.Millisecond)
		for _, index := range []int{2, 0, 2} {
			if err := env.Repo.AddChunk(ctx, created.ID, index, extended); err != nil {
				t.Fatal(err)
			}
		}
		got, _ := env.Repo.GetSession(ctx, created.ID)
		if !slices.Equal(got.UploadedChunks, []int{2, 0}) || !got.ExpiresAt.Equal(extended) {
			t.Fatalf("chunks %v expires %v", got.UploadedChunks, got.ExpiresAt)
		}
	})

	t.Run("status changes only from the expected state", func(t *testing.T) {
		env := newEnv(t)
		created, _ := env.Repo.CreateSession(ctx, newSession(env.NewUser(t), "/spool/b.part", later))
		mime := upload.DefaultMimeType
		if changed, err := env.Repo.SetStatus(ctx, created.ID, upload.StatusCompleted, upload.StatusExpired); err != nil || changed {
			t.Fatalf("wrong source state must not change: %v %v", changed, err)
		}
		if changed, err := env.Repo.Complete(ctx, created.ID, "digest", mime); err != nil || !changed {
			t.Fatalf("complete: %v %v", changed, err)
		}
		got, _ := env.Repo.GetSession(ctx, created.ID)
		if got.Status != upload.StatusCompleted || got.FileHash != "digest" || got.MimeType == nil || *got.MimeType != mime {
			t.Fatalf("after complete %+v", got)
		}
		if changed, err := env.Repo.Complete(ctx, created.ID, "other", mime); err != nil || changed {
			t.Fatalf("a completed session is not completed again: %v %v", changed, err)
		}
		if changed, err := env.Repo.SetStatus(ctx, 987654, upload.StatusUploading, upload.StatusAborted); err != nil || changed {
			t.Fatalf("missing session: %v %v", changed, err)
		}
	})

	t.Run("pending bytes count what live uploads have still to write", func(t *testing.T) {
		env := newEnv(t)
		user := env.NewUser(t)
		started, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/p1.part", later))
		halfway, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/p2.part", later))
		if err := env.Repo.AddChunk(ctx, halfway.ID, 0, later); err != nil {
			t.Fatal(err)
		}
		_, _ = env.Repo.CreateSession(ctx, newSession(user, "/spool/p3.part", time.Now().Add(-time.Minute)))
		done, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/p4.part", later))
		_, _ = env.Repo.Complete(ctx, done.ID, "digest", upload.DefaultMimeType)
		pending, err := env.Repo.PendingBytes(ctx, time.Now())
		if err != nil || pending != started.TotalSize+halfway.TotalSize-halfway.ChunkSize {
			t.Fatalf("pending bytes: %d %v", pending, err)
		}
	})

	t.Run("ongoing lists live uploads and finished uploads not yet in a resource", func(t *testing.T) {
		env := newEnv(t)
		user, other := env.NewUser(t), env.NewUser(t)
		first, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c1.part", later))
		second, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c2.part", later))
		_, _ = env.Repo.CreateSession(ctx, newSession(user, "/spool/c3.part", time.Now().Add(-time.Minute)))
		done, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c4.part", later))
		_, _ = env.Repo.SetStatus(ctx, done.ID, upload.StatusUploading, upload.StatusAborted)
		_, _ = env.Repo.CreateSession(ctx, newSession(other, "/spool/c5.part", later))
		finished, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c6.part", later))
		_, _ = env.Repo.Complete(ctx, finished.ID, "digest", upload.DefaultMimeType)
		used, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/c7.part", later))
		_, _ = env.Repo.Complete(ctx, used.ID, "digest", upload.DefaultMimeType)
		env.AttachFile(t, used.ID, "/spool/c7.part")
		got, err := env.Repo.ListOngoing(ctx, user, time.Now(), 10)
		if err != nil || len(got) != 3 || got[0].ID != first.ID || got[1].ID != second.ID || got[2].ID != finished.ID || got[2].Status != upload.StatusCompleted {
			t.Fatalf("ongoing %+v %v", got, err)
		}
		limited, _ := env.Repo.ListOngoing(ctx, user, time.Now(), 1)
		if len(limited) != 1 {
			t.Fatalf("limit ignored: %+v", limited)
		}
	})

	t.Run("stale sessions and referenced paths", func(t *testing.T) {
		env := newEnv(t)
		user, idle := env.NewUser(t), env.NewUser(t)
		aborted, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s1.part", later))
		_, _ = env.Repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted)
		expiredUpload, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s2.part", time.Now().Add(-48*time.Hour)))
		live, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s3.part", later))
		keptCompleted, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s4.part", later))
		_, _ = env.Repo.Complete(ctx, keptCompleted.ID, "digest", upload.DefaultMimeType)
		orphanCompleted, _ := env.Repo.CreateSession(ctx, newSession(idle, "/spool/s7.part", later))
		_, _ = env.Repo.Complete(ctx, orphanCompleted.ID, "digest", upload.DefaultMimeType)
		attached, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s5.part", later))
		_, _ = env.Repo.Complete(ctx, attached.ID, "digest", upload.DefaultMimeType)
		env.AttachFile(t, attached.ID, "/spool/s5.part")
		finished, _ := env.Repo.CreateSession(ctx, newSession(user, "/spool/s6.part", time.Now().Add(-48*time.Hour)))
		_, _ = env.Repo.SetStatus(ctx, finished.ID, upload.StatusUploading, upload.StatusExpired)

		now := time.Now()
		stale, err := env.Repo.ListStale(ctx, now, now.Add(time.Hour), 10)
		if err != nil {
			t.Fatal(err)
		}
		var ids []int
		for _, session := range stale {
			ids = append(ids, session.ID)
		}
		if !slices.Equal(ids, []int{aborted.ID, expiredUpload.ID, orphanCompleted.ID}) {
			t.Fatalf("stale ids %v (live %d kept %d attached %d expired %d)", ids, live.ID, keptCompleted.ID, attached.ID, finished.ID)
		}
		if busy, err := env.Repo.HasLiveUpload(ctx, user, now); err != nil || !busy {
			t.Fatalf("a user with an upload in progress: %v %v", busy, err)
		}
		if busy, _ := env.Repo.HasLiveUpload(ctx, idle, now); busy {
			t.Fatal("finished uploads are not live")
		}
		recent, _ := env.Repo.ListStale(ctx, now, now.Add(-time.Hour), 10)
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
