package upload_test

import (
	"bytes"
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	uploader = actor.Actor{UserID: 1, Role: actor.RoleUser}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser}
	admin    = actor.Actor{UserID: 3, Role: actor.RoleAdmin}
	now      = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
)

type fixture struct {
	repo    *uploadtest.MemoryRepository
	quotas  *uploadtest.MemoryQuotaRepository
	spool   *uploadtest.MemorySpool
	quota   *upload.QuotaService
	service *upload.Service
}

func newFixture() fixture {
	repo := uploadtest.NewMemoryRepository(func() time.Time { return now })
	quotas := uploadtest.NewMemoryQuotaRepository()
	spool := uploadtest.NewMemorySpool()
	tx := &txtest.Immediate{}
	quota := upload.NewQuotaService(quotas, tx, upload.QuotaPolicy{BaseBytes: 100, CapBytes: 400, TopupStepBytes: 50, TopupThresholdBytes: 30, ReduceStepBytes: 20, ReduceInactiveDays: 45, GrantAfterDays: 7, LongestInactiveDays: 120}, func() time.Time { return now })
	service := upload.NewService(repo, quota, spool, tx, upload.Options{ChunkSize: 4, MaxChunks: 5, MaxFileSize: 16, TransferLimit: 8, SessionTTL: 24 * time.Hour}, func() time.Time { return now })
	return fixture{repo: repo, quotas: quotas, spool: spool, quota: quota, service: service}
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

func (f fixture) startUpload(t *testing.T, content []byte) upload.Session {
	t.Helper()
	session, err := f.service.Init(context.Background(), uploader, upload.InitInput{FileName: "game.7z", TotalSize: int64(len(content)), FileHash: uploadtest.Digest(content)})
	if err != nil {
		t.Fatal(err)
	}
	return session
}

func (f fixture) sendChunks(t *testing.T, session upload.Session, content []byte) {
	t.Helper()
	for index := range session.TotalChunks {
		start := int(session.ChunkOffset(index))
		chunk := content[start : start+int(session.ChunkLength(index))]
		if err := f.service.WriteChunk(context.Background(), uploader, session.ID, index, upload.Chunk{SHA256: uploadtest.Digest(chunk), ContentLength: int64(len(chunk))}, bytes.NewReader(chunk)); err != nil {
			t.Fatalf("chunk %d: %v", index, err)
		}
	}
}

func TestInitValidatesQuotaAndLimits(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	_, err := f.service.Init(ctx, uploader, upload.InitInput{FileName: "a", TotalSize: 4, FileHash: "h"})
	expectCode(t, err, upload.ErrQuotaNotFound)

	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 30, Used: 10})
	f.quotas.SeedQuota(upload.Quota{UserID: admin.UserID, Size: 100})
	cases := []struct {
		name string
		who  actor.Actor
		in   upload.InitInput
		want apperror.Definition
	}{
		{name: "quota exceeded", who: uploader, in: upload.InitInput{TotalSize: 21}, want: upload.ErrQuotaExceeded},
		{name: "chunk size above the transfer limit", who: uploader, in: upload.InitInput{TotalSize: 8, ChunkSize: ptr[int64](9)}, want: upload.ErrInvalidChunkSize},
		{name: "zero chunk size", who: uploader, in: upload.InitInput{TotalSize: 8, ChunkSize: ptr[int64](0)}, want: upload.ErrInvalidChunkSize},
		{name: "empty file", who: uploader, in: upload.InitInput{TotalSize: 0}, want: upload.ErrInvalidTotalSize},
		{name: "too many chunks", who: uploader, in: upload.InitInput{TotalSize: 20, ChunkSize: ptr[int64](2)}, want: upload.ErrTooManyChunks},
		{name: "too large for users", who: uploader, in: upload.InitInput{TotalSize: 17, ChunkSize: ptr[int64](8)}, want: upload.ErrTooLarge},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.service.Init(ctx, tc.who, tc.in)
			expectCode(t, err, tc.want)
		})
	}
	if _, err := f.service.Init(ctx, admin, upload.InitInput{FileName: "big", TotalSize: 17, ChunkSize: ptr[int64](8), FileHash: "h"}); err != nil {
		t.Fatalf("admins bypass the size cap: %v", err)
	}
}

func TestInitCreatesSessionFileAndCharge(t *testing.T) {
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	session, err := f.service.Init(context.Background(), uploader, upload.InitInput{FileName: "game.7z", TotalSize: 10, FileHash: "hash"})
	if err != nil {
		t.Fatal(err)
	}
	if session.ChunkSize != 4 || session.TotalChunks != 3 || session.StoragePath != f.spool.Path("1") || !session.ExpiresAt.Equal(now.Add(24*time.Hour)) {
		t.Fatalf("unexpected session %+v", session)
	}
	stored, _ := f.repo.GetSession(context.Background(), session.ID)
	if stored.StoragePath != f.spool.Path("1") || stored.Status != upload.StatusUploading || stored.HashAlgorithm != upload.HashBLAKE3 {
		t.Fatalf("stored session %+v", stored)
	}
	if content, ok := f.spool.Content(session.StoragePath); !ok || len(content) != 10 {
		t.Fatalf("file must be preallocated to the total size: %d %v", len(content), ok)
	}
	quota := f.quotas.Quota(uploader.UserID)
	records := f.quotas.Records()
	if quota.Used != 10 || len(records) != 1 || records[0].Action != upload.ActionUse || records[0].Field != upload.FieldUsed || *records[0].SessionID != session.ID || *records[0].Reason != upload.ReasonGameUpload {
		t.Fatalf("quota charge %+v %+v", quota, records)
	}
}

func TestInitAbortsWhenTheFileCannotBeAllocated(t *testing.T) {
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	f.spool.FailNext = errors.New("disk full")
	if _, err := f.service.Init(context.Background(), uploader, upload.InitInput{FileName: "a", TotalSize: 4, FileHash: "h"}); err == nil {
		t.Fatal("expected allocation failure")
	}
	stored, _ := f.repo.GetSession(context.Background(), 1)
	if stored.Status != upload.StatusAborted {
		t.Fatalf("session must be aborted for cleanup: %+v", stored)
	}
}

func TestWriteChunkRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	content := []byte("0123456789")
	session := f.startUpload(t, content)
	chunk := func(index int) upload.Chunk {
		start := int(session.ChunkOffset(index))
		part := content[start : start+int(session.ChunkLength(index))]
		return upload.Chunk{SHA256: uploadtest.Digest(part), ContentLength: int64(len(part))}
	}
	expired := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 1, TotalSize: 4, ChunkSize: 4, CreatorID: uploader.UserID, ExpiresAt: now.Add(-time.Second)})
	done := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, TotalChunks: 1, TotalSize: 4, ChunkSize: 4, CreatorID: uploader.UserID, ExpiresAt: now.Add(time.Hour)})

	expectCode(t, f.service.WriteChunk(ctx, uploader, 999, 0, chunk(0), nil), upload.ErrSessionNotFound)
	expectCode(t, f.service.WriteChunk(ctx, uploader, done.ID, 0, chunk(0), nil), upload.ErrInvalidSessionStatus)
	expectCode(t, f.service.WriteChunk(ctx, uploader, session.ID, 3, chunk(0), nil), upload.ErrInvalidChunkIndex)
	expectCode(t, f.service.WriteChunk(ctx, uploader, session.ID, -1, chunk(0), nil), upload.ErrInvalidChunkIndex)
	expectCode(t, f.service.WriteChunk(ctx, uploader, expired.ID, 0, chunk(0), nil), upload.ErrSessionExpired)
	expectCode(t, f.service.WriteChunk(ctx, stranger, session.ID, 0, chunk(0), nil), upload.ErrSessionNotOwner)

	wrongLength := f.service.WriteChunk(ctx, uploader, session.ID, 2, upload.Chunk{SHA256: "x", ContentLength: 4}, nil)
	expectCode(t, wrongLength, upload.ErrUnexpectedLength)
	if appErr, _ := apperror.From(wrongLength); appErr.Args()["expected"] != "2" || appErr.Args()["actual"] != "4" {
		t.Fatalf("length args %v", appErr.Args())
	}

	bad := chunk(1)
	bad.SHA256 = "nope"
	expectCode(t, f.service.WriteChunk(ctx, uploader, session.ID, 1, bad, bytes.NewReader(content[4:8])), upload.ErrChunkSHA256Mismatch)
	if stored, _ := f.repo.GetSession(ctx, session.ID); len(stored.UploadedChunks) != 0 {
		t.Fatalf("mismatched chunks are not recorded: %v", stored.UploadedChunks)
	}
	if err := f.service.WriteChunk(ctx, uploader, session.ID, 1, chunk(1), bytes.NewReader(content[4:8])); err != nil {
		t.Fatal(err)
	}
	if err := f.service.WriteChunk(ctx, uploader, session.ID, 1, chunk(1), bytes.NewReader([]byte("ignored"))); err != nil {
		t.Fatalf("re-sending a verified chunk is idempotent: %v", err)
	}
	expectCode(t, f.service.WriteChunk(ctx, uploader, session.ID, 1, bad, nil), upload.ErrInvalidChunkSHA256)
	stored, _ := f.repo.GetSession(ctx, session.ID)
	if !slices.Equal(stored.UploadedChunks, []int{1}) {
		t.Fatalf("chunks %v", stored.UploadedChunks)
	}
}

func TestStatusAndComplete(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	content := []byte("0123456789")
	session := f.startUpload(t, content)

	expectCode(t, f.service.Complete(ctx, uploader, session.ID), upload.ErrIncomplete)
	f.sendChunks(t, session, content)
	if _, err := f.service.Status(ctx, stranger, session.ID); !errors.Is(err, upload.ErrSessionNotOwner) {
		t.Fatalf("status owner: %v", err)
	}
	status, err := f.service.Status(ctx, uploader, session.ID)
	if err != nil || !slices.Equal(status.SortedChunks(), []int{0, 1, 2}) {
		t.Fatalf("status %+v %v", status, err)
	}
	expectCode(t, f.service.Complete(ctx, stranger, session.ID), upload.ErrSessionNotOwner)

	tampered := f.startUpload(t, content)
	f.sendChunks(t, tampered, []byte("abcdefghij"))
	expectCode(t, f.service.Complete(ctx, uploader, tampered.ID), upload.ErrFileBLAKE3Mismatch)

	if err := f.service.Complete(ctx, uploader, session.ID); err != nil {
		t.Fatal(err)
	}
	completed, _ := f.repo.GetSession(ctx, session.ID)
	if completed.Status != upload.StatusCompleted || completed.MimeType == nil || *completed.MimeType != upload.DefaultMimeType {
		t.Fatalf("completed %+v", completed)
	}
	expectCode(t, f.service.Complete(ctx, uploader, session.ID), upload.ErrInvalidSessionStatus)
	after, err := f.service.Status(ctx, uploader, session.ID)
	if err != nil || after.Status != upload.StatusCompleted {
		t.Fatalf("status works for completed sessions: %+v %v", after, err)
	}

	expired := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 1, UploadedChunks: []int{0, 0}, CreatorID: uploader.UserID, ExpiresAt: now.Add(-time.Second)})
	expectCode(t, f.service.Complete(ctx, uploader, expired.ID), upload.ErrSessionExpired)
	_, err = f.service.Status(ctx, uploader, expired.ID)
	expectCode(t, err, upload.ErrSessionExpired)
	duplicated := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 2, UploadedChunks: []int{0, 0}, CreatorID: uploader.UserID, ExpiresAt: now.Add(time.Hour)})
	expectCode(t, f.service.Complete(ctx, uploader, duplicated.ID), upload.ErrIncomplete)
}

func TestAbortRefundsAndRemovesTheFile(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	session := f.startUpload(t, []byte("0123456789"))
	expectCode(t, f.service.Abort(ctx, stranger, session.ID), upload.ErrSessionNotOwner)
	if err := f.service.Abort(ctx, uploader, session.ID); err != nil {
		t.Fatal(err)
	}
	stored, _ := f.repo.GetSession(ctx, session.ID)
	if stored.Status != upload.StatusAborted || f.quotas.Quota(uploader.UserID).Used != 0 {
		t.Fatalf("abort %+v %+v", stored, f.quotas.Quota(uploader.UserID))
	}
	if _, ok := f.spool.Content(session.StoragePath); ok {
		t.Fatal("temp file must be removed")
	}
	expectCode(t, f.service.Abort(ctx, uploader, session.ID), upload.ErrInvalidSessionStatus)
}

func TestClaimChecksStatusThenOwner(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	uploading := f.repo.Seed(upload.Session{Status: upload.StatusUploading, CreatorID: uploader.UserID})
	completed := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID})
	_, err := f.service.Claim(ctx, uploader, 999)
	expectCode(t, err, upload.ErrSessionNotFound)
	_, err = f.service.Claim(ctx, stranger, uploading.ID)
	expectCode(t, err, upload.ErrInvalidSessionStatus)
	_, err = f.service.Claim(ctx, stranger, completed.ID)
	expectCode(t, err, upload.ErrSessionNotOwner)
	if got, err := f.service.Claim(ctx, uploader, completed.ID); err != nil || got.ID != completed.ID {
		t.Fatalf("claim %+v %v", got, err)
	}
}

func TestCleanStaleSessionsExpiresAndRefunds(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedQuota(upload.Quota{UserID: uploader.UserID, Size: 100})
	aborted := f.startUpload(t, []byte("0123"))
	if _, err := f.repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted, nil); err != nil {
		t.Fatal(err)
	}
	attached := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("x"), Updated: now.Add(-7 * time.Hour)})
	f.repo.AttachFile(attached.ID, attached.StoragePath)
	orphan := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("y"), Updated: now.Add(-7 * time.Hour)})
	f.spool.Put(orphan.StoragePath, []byte("data"), now)
	expired := f.repo.Seed(upload.Session{Status: upload.StatusUploading, CreatorID: uploader.UserID, StoragePath: "/elsewhere/z", ExpiresAt: now.Add(-7 * time.Hour)})

	if err := f.service.CleanStaleSessions(ctx); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int{aborted.ID, orphan.ID, expired.ID} {
		if got, _ := f.repo.GetSession(ctx, id); got.Status != upload.StatusExpired {
			t.Fatalf("session %d should be expired: %+v", id, got)
		}
	}
	if got, _ := f.repo.GetSession(ctx, attached.ID); got.Status != upload.StatusCompleted {
		t.Fatalf("attached sessions stay completed: %+v", got)
	}
	if f.quotas.Quota(uploader.UserID).Used != 0 {
		t.Fatalf("aborted upload must be refunded: %+v", f.quotas.Quota(uploader.UserID))
	}
	removed := f.spool.Removed()
	if !slices.Contains(removed, aborted.StoragePath) || !slices.Contains(removed, orphan.StoragePath) || slices.Contains(removed, "/elsewhere/z") {
		t.Fatalf("only files under the spool root are removed: %v", removed)
	}
}

func TestCleanOrphansRemovesOnlyUnreferencedFiles(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	live := f.repo.Seed(upload.Session{Status: upload.StatusUploading, StoragePath: f.spool.Path("live")})
	f.spool.Put(live.StoragePath, []byte("a"), now.Add(-72*time.Hour))
	f.spool.Put(f.spool.Path("orphan"), []byte("b"), now.Add(-72*time.Hour))
	f.spool.Put(f.spool.Path("fresh"), []byte("c"), now.Add(-time.Hour))
	if err := f.service.CleanOrphans(ctx); err != nil {
		t.Fatal(err)
	}
	if removed := f.spool.Removed(); !slices.Equal(removed, []string{f.spool.Path("orphan")}) {
		t.Fatalf("removed %v", removed)
	}
}
