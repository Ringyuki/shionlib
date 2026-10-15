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
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
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
	settings := testSettings()
	quota := upload.NewQuotaService(quotas, settings, func() time.Time { return now })
	service := upload.NewService(repo, quota, spool, uploadtest.NewMemoryHolds(), tx, settings, func() time.Time { return now })
	return fixture{repo: repo, quotas: quotas, spool: spool, quota: quota, service: service}
}

func testSettings() settingtest.Source {
	settings := settingtest.Source{}
	settingtest.Set(settings, upload.NewUploaderQuota, 100)
	settingtest.Set(settings, upload.RegularQuota, 400)
	settingtest.Set(settings, upload.TrustedQuota, 1000)
	settingtest.Set(settings, upload.InFlightLimit, 50)
	settingtest.Set(settings, upload.SpoolReserve, 10)
	settingtest.Set(settings, upload.ChunkSize, 4)
	settingtest.Set(settings, upload.ChunkLimit, 8)
	settingtest.Set(settings, upload.MaxChunks, 5)
	return settingtest.Set(settings, upload.MaxFileSize, 16)
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
	session, err := f.service.Init(context.Background(), uploader, "", upload.InitInput{FileName: "game.7z", TotalSize: int64(len(content))})
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
		if err := f.service.WriteChunk(context.Background(), uploader, "", session.ID, index, upload.Chunk{SHA256: uploadtest.Digest(chunk), ContentLength: int64(len(chunk))}, bytes.NewReader(chunk)); err != nil {
			t.Fatalf("chunk %d: %v", index, err)
		}
	}
}

func TestInitValidatesLimits(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	cases := []struct {
		name string
		in   upload.InitInput
		want apperror.Definition
	}{
		{name: "chunk size above the transfer limit", in: upload.InitInput{TotalSize: 8, ChunkSize: ptr[int64](9)}, want: upload.ErrInvalidChunkSize},
		{name: "zero chunk size", in: upload.InitInput{TotalSize: 8, ChunkSize: ptr[int64](0)}, want: upload.ErrInvalidChunkSize},
		{name: "empty file", in: upload.InitInput{TotalSize: 0}, want: upload.ErrInvalidTotalSize},
		{name: "too many chunks", in: upload.InitInput{TotalSize: 20, ChunkSize: ptr[int64](2)}, want: upload.ErrTooManyChunks},
		{name: "too large for new uploaders", in: upload.InitInput{TotalSize: 17, ChunkSize: ptr[int64](8)}, want: upload.ErrTooLarge},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.service.Init(ctx, uploader, "", tc.in)
			expectCode(t, err, tc.want)
		})
	}
}

func TestInitAdmitsUploadsByAllowance(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.quotas.SeedUsage(uploader.UserID, 80, 10)
	_, err := f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "a", TotalSize: 11})
	expectCode(t, err, upload.ErrQuotaExceeded)
	f.quotas.SeedUsage(uploader.UserID, 0, 45)
	_, err = f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "a", TotalSize: 8})
	expectCode(t, err, upload.ErrInFlightExceeded)
	f.quotas.SeedUsage(uploader.UserID, 0, 0)
	f.quotas.SeedStanding(uploader.UserID, upload.Standing{Role: actor.RoleUser, Trusted: true})
	if _, err := f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "big", TotalSize: 17, ChunkSize: ptr[int64](8)}); err != nil {
		t.Fatalf("trusted uploaders have no file size cap: %v", err)
	}
	f.quotas.SeedStanding(admin.UserID, upload.Standing{Role: actor.RoleAdmin})
	f.quotas.SeedUsage(admin.UserID, 1<<40, 0)
	if _, err := f.service.Init(ctx, admin, "", upload.InitInput{FileName: "big", TotalSize: 17, ChunkSize: ptr[int64](8)}); err != nil {
		t.Fatalf("admins store without limit: %v", err)
	}
}

func TestInitKeepsTheSpoolReserve(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.spool.Space = 30
	if _, err := f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "a", TotalSize: 16, ChunkSize: ptr[int64](8)}); err != nil {
		t.Fatal(err)
	}
	_, err := f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "b", TotalSize: 8})
	expectCode(t, err, upload.ErrSpoolFull)
	f.spool.Space = 34
	if _, err := f.service.Init(ctx, uploader, "", upload.InitInput{FileName: "b", TotalSize: 8}); err != nil {
		t.Fatalf("the reserve counts what running uploads have still to write: %v", err)
	}
}

func TestInitCreatesSessionAndFile(t *testing.T) {
	f := newFixture()
	session, err := f.service.Init(context.Background(), uploader, "", upload.InitInput{FileName: "game.7z", TotalSize: 10})
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
}

func TestInitAbortsWhenTheFileCannotBeAllocated(t *testing.T) {
	f := newFixture()
	f.spool.FailNext = errors.New("disk full")
	if _, err := f.service.Init(context.Background(), uploader, "", upload.InitInput{FileName: "a", TotalSize: 4}); err == nil {
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
	content := []byte("0123456789")
	session := f.startUpload(t, content)
	chunk := func(index int) upload.Chunk {
		start := int(session.ChunkOffset(index))
		part := content[start : start+int(session.ChunkLength(index))]
		return upload.Chunk{SHA256: uploadtest.Digest(part), ContentLength: int64(len(part))}
	}
	expired := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 1, TotalSize: 4, ChunkSize: 4, CreatorID: uploader.UserID, ExpiresAt: now.Add(-time.Second)})
	done := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, TotalChunks: 1, TotalSize: 4, ChunkSize: 4, CreatorID: uploader.UserID, ExpiresAt: now.Add(time.Hour)})

	expectCode(t, f.service.WriteChunk(ctx, uploader, "", 999, 0, chunk(0), nil), upload.ErrSessionNotFound)
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", done.ID, 0, chunk(0), nil), upload.ErrInvalidSessionStatus)
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", session.ID, 3, chunk(0), nil), upload.ErrInvalidChunkIndex)
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", session.ID, -1, chunk(0), nil), upload.ErrInvalidChunkIndex)
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", expired.ID, 0, chunk(0), nil), upload.ErrSessionExpired)
	expectCode(t, f.service.WriteChunk(ctx, stranger, "", session.ID, 0, chunk(0), nil), upload.ErrSessionNotOwner)

	wrongLength := f.service.WriteChunk(ctx, uploader, "", session.ID, 2, upload.Chunk{SHA256: "x", ContentLength: 4}, nil)
	expectCode(t, wrongLength, upload.ErrUnexpectedLength)
	if appErr, _ := apperror.From(wrongLength); appErr.Args()["expected"] != "2" || appErr.Args()["actual"] != "4" {
		t.Fatalf("length args %v", appErr.Args())
	}

	bad := chunk(1)
	bad.SHA256 = "nope"
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", session.ID, 1, bad, bytes.NewReader(content[4:8])), upload.ErrChunkSHA256Mismatch)
	if stored, _ := f.repo.GetSession(ctx, session.ID); len(stored.UploadedChunks) != 0 {
		t.Fatalf("mismatched chunks are not recorded: %v", stored.UploadedChunks)
	}
	if err := f.service.WriteChunk(ctx, uploader, "", session.ID, 1, chunk(1), bytes.NewReader(content[4:8])); err != nil {
		t.Fatal(err)
	}
	if err := f.service.WriteChunk(ctx, uploader, "", session.ID, 1, chunk(1), bytes.NewReader([]byte("ignored"))); err != nil {
		t.Fatalf("re-sending a verified chunk is idempotent: %v", err)
	}
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", session.ID, 1, bad, nil), upload.ErrInvalidChunkSHA256)
	stored, _ := f.repo.GetSession(ctx, session.ID)
	if !slices.Equal(stored.UploadedChunks, []int{1}) || !stored.ExpiresAt.Equal(now.Add(upload.SessionTTL.Read(testSettings()))) {
		t.Fatalf("each new chunk records itself and extends the session: %v %v", stored.UploadedChunks, stored.ExpiresAt)
	}
}

func TestStatusAndComplete(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	content := []byte("0123456789")
	session := f.startUpload(t, content)

	digest := uploadtest.Digest(content)
	expectCode(t, f.service.Complete(ctx, uploader, "", session.ID, digest), upload.ErrIncomplete)
	f.sendChunks(t, session, content)
	if _, err := f.service.Status(ctx, stranger, session.ID); !errors.Is(err, upload.ErrSessionNotOwner) {
		t.Fatalf("status owner: %v", err)
	}
	status, err := f.service.Status(ctx, uploader, session.ID)
	if err != nil || !slices.Equal(status.SortedChunks(), []int{0, 1, 2}) {
		t.Fatalf("status %+v %v", status, err)
	}
	expectCode(t, f.service.Complete(ctx, stranger, "", session.ID, digest), upload.ErrSessionNotOwner)

	tampered := f.startUpload(t, content)
	f.sendChunks(t, tampered, []byte("abcdefghij"))
	expectCode(t, f.service.Complete(ctx, uploader, "", tampered.ID, digest), upload.ErrFileBLAKE3Mismatch)

	expectCode(t, f.service.Complete(ctx, uploader, "", session.ID, uploadtest.Digest([]byte("something else"))), upload.ErrFileBLAKE3Mismatch)
	if err := f.service.Complete(ctx, uploader, "", session.ID, digest); err != nil {
		t.Fatal(err)
	}
	completed, _ := f.repo.GetSession(ctx, session.ID)
	if completed.Status != upload.StatusCompleted || completed.FileHash != digest || completed.MimeType == nil || *completed.MimeType != upload.DefaultMimeType {
		t.Fatalf("completed %+v", completed)
	}
	if err := f.service.Complete(ctx, uploader, "", session.ID, digest); err != nil {
		t.Fatalf("completing again with the same digest succeeds: %v", err)
	}
	expectCode(t, f.service.Complete(ctx, uploader, "", session.ID, uploadtest.Digest([]byte("something else"))), upload.ErrInvalidSessionStatus)
	after, err := f.service.Status(ctx, uploader, session.ID)
	if err != nil || after.Status != upload.StatusCompleted {
		t.Fatalf("status works for completed sessions: %+v %v", after, err)
	}

	expired := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 1, UploadedChunks: []int{0, 0}, CreatorID: uploader.UserID, ExpiresAt: now.Add(-time.Second)})
	expectCode(t, f.service.Complete(ctx, uploader, "", expired.ID, digest), upload.ErrSessionExpired)
	_, err = f.service.Status(ctx, uploader, expired.ID)
	expectCode(t, err, upload.ErrSessionExpired)
	duplicated := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 2, UploadedChunks: []int{0, 0}, CreatorID: uploader.UserID, ExpiresAt: now.Add(time.Hour)})
	expectCode(t, f.service.Complete(ctx, uploader, "", duplicated.ID, digest), upload.ErrIncomplete)
}

func TestAbortRemovesTheFile(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	session := f.startUpload(t, []byte("0123456789"))
	expectCode(t, f.service.Abort(ctx, stranger, "", session.ID), upload.ErrSessionNotOwner)
	if err := f.service.Abort(ctx, uploader, "", session.ID); err != nil {
		t.Fatal(err)
	}
	stored, _ := f.repo.GetSession(ctx, session.ID)
	if stored.Status != upload.StatusAborted {
		t.Fatalf("abort %+v", stored)
	}
	if _, ok := f.spool.Content(session.StoragePath); ok {
		t.Fatal("temp file must be removed")
	}
	expectCode(t, f.service.Abort(ctx, uploader, "", session.ID), upload.ErrInvalidSessionStatus)
}

func TestAbortDiscardsFinishedUploadsNotYetInAResource(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	finished := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("finished")})
	f.spool.Put(finished.StoragePath, []byte("data"), now)
	used := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("used")})
	f.repo.AttachFile(used.ID, used.StoragePath)
	expectCode(t, f.service.Abort(ctx, uploader, "", used.ID), upload.ErrSessionAlreadyUsed)
	if err := f.service.Abort(ctx, uploader, "", finished.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetSession(ctx, finished.ID); got.Status != upload.StatusAborted {
		t.Fatalf("discarded %+v", got)
	}
	if _, ok := f.spool.Content(finished.StoragePath); ok {
		t.Fatal("the finished file is removed")
	}
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

func TestAFinishedUploadIsHandedOverOnceAndLeavesTheSpoolRoot(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	content := []byte("0123456789")
	finished := f.startUpload(t, content)
	f.sendChunks(t, finished, content)
	if err := f.service.Complete(ctx, uploader, "", finished.ID, uploadtest.Digest(content)); err != nil {
		t.Fatal(err)
	}
	target := uploadtest.SpoolRoot + ".compose/7/inputs/patch.zip"

	if _, err := f.service.Take(ctx, uploader, finished.ID, "/elsewhere/patch.zip"); err == nil {
		t.Fatal("a file is never moved out of the spool")
	}
	_, err := f.service.Take(ctx, stranger, finished.ID, target)
	expectCode(t, err, upload.ErrSessionNotOwner)

	taken, err := f.service.Take(ctx, uploader, finished.ID, target)
	if err != nil || taken.ID != finished.ID || taken.TotalSize != int64(len(content)) {
		t.Fatalf("taken: %+v %v", taken, err)
	}
	if moved, ok := f.spool.Content(target); !ok || string(moved) != string(content) {
		t.Fatalf("the file is at its new place: %q %v", moved, ok)
	}
	if _, still := f.spool.Content(finished.StoragePath); still {
		t.Fatal("nothing is left at the old place")
	}
	if got, _ := f.repo.GetSession(ctx, finished.ID); got.Status != upload.StatusExpired {
		t.Fatalf("a handed over upload is used up: %+v", got)
	}
	_, err = f.service.Take(ctx, uploader, finished.ID, target)
	expectCode(t, err, upload.ErrInvalidSessionStatus)

	attached := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: uploadtest.SpoolRoot + "9.part"})
	f.repo.AttachFile(attached.ID, attached.StoragePath)
	_, err = f.service.Take(ctx, uploader, attached.ID, target)
	expectCode(t, err, upload.ErrSessionAlreadyUsed)
}

func TestCleanStaleSessionsExpiresThem(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	aborted := f.startUpload(t, []byte("0123"))
	if _, err := f.repo.SetStatus(ctx, aborted.ID, upload.StatusUploading, upload.StatusAborted); err != nil {
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
	removed := f.spool.Removed()
	if !slices.Contains(removed, aborted.StoragePath) || !slices.Contains(removed, orphan.StoragePath) || slices.Contains(removed, "/elsewhere/z") {
		t.Fatalf("only files under the spool root are removed: %v", removed)
	}
}

func TestFinishedUploadsWaitWhileTheUploaderIsStillUploading(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	finished := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("first"), Updated: now.Add(-7 * time.Hour)})
	f.startUpload(t, []byte("0123"))
	if err := f.service.CleanStaleSessions(ctx); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetSession(ctx, finished.ID); got.Status != upload.StatusCompleted {
		t.Fatalf("the first file of a batch survives while the rest uploads: %+v", got)
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

func TestASessionIsHeldByTheClientThatUploadsIt(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	content := []byte("0123456789")
	session := f.startUpload(t, content)
	send := func(holder string, index int) error {
		start := int(session.ChunkOffset(index))
		chunk := content[start : start+int(session.ChunkLength(index))]
		return f.service.WriteChunk(ctx, uploader, holder, session.ID, index, upload.Chunk{SHA256: uploadtest.Digest(chunk), ContentLength: int64(len(chunk))}, bytes.NewReader(chunk))
	}
	if err := send("phone", 0); err != nil {
		t.Fatal(err)
	}
	expectCode(t, send("laptop", 1), upload.ErrHeldElsewhere)
	expectCode(t, send("", 1), upload.ErrHeldElsewhere)
	expectCode(t, f.service.Complete(ctx, uploader, "laptop", session.ID, uploadtest.Digest(content)), upload.ErrHeldElsewhere)
	expectCode(t, f.service.Abort(ctx, uploader, "laptop", session.ID), upload.ErrHeldElsewhere)

	seen := func(holder string) upload.OngoingSession {
		t.Helper()
		ongoing, err := f.service.Ongoing(ctx, uploader, holder)
		if err != nil || len(ongoing) != 1 {
			t.Fatalf("ongoing for %q: %+v %v", holder, ongoing, err)
		}
		return ongoing[0]
	}
	if seen("phone").HeldElsewhere || !seen("laptop").HeldElsewhere || !seen("").HeldElsewhere {
		t.Fatal("only the holder sees the session as its own")
	}

	opened, err := f.service.Init(ctx, uploader, "phone", upload.InitInput{FileName: "next.7z", TotalSize: 4})
	if err != nil {
		t.Fatal(err)
	}
	expectCode(t, f.service.Abort(ctx, uploader, "laptop", opened.ID), upload.ErrHeldElsewhere)
	if err := f.service.Abort(ctx, uploader, "phone", opened.ID); err != nil {
		t.Fatalf("the client that opened a session holds it from the start: %v", err)
	}

	other := f.startUpload(t, content)
	holdings, err := f.service.Hold(ctx, uploader, "laptop", []int{session.ID, other.ID, 99})
	if err != nil || !slices.Equal(holdings.Held, []int{other.ID}) || !slices.Equal(holdings.Elsewhere, []int{session.ID}) {
		t.Fatalf("holding the queue of another client: %+v %v", holdings, err)
	}
	stranger, err := f.service.Hold(ctx, admin, "tablet", []int{session.ID})
	if err != nil || len(stranger.Held)+len(stranger.Elsewhere) != 0 {
		t.Fatalf("someone else's sessions are not theirs to hold: %+v %v", stranger, err)
	}

	for index := 1; index < session.TotalChunks; index++ {
		if err := send("phone", index); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.service.Complete(ctx, uploader, "phone", session.ID, uploadtest.Digest(content)); err != nil {
		t.Fatalf("the holder completes: %v", err)
	}
}

func TestReportFailureRecordsWhatTheBrowserSaw(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	session := f.repo.Seed(upload.Session{Status: upload.StatusUploading, TotalChunks: 3, CreatorID: uploader.UserID, ExpiresAt: now.Add(time.Hour)})
	attempts := make([]upload.FailureAttempt, upload.MaxFailureAttempts+2)
	for i := range attempts {
		attempts[i] = upload.FailureAttempt{At: now.Add(time.Duration(i) * time.Second), Wait: "network", Error: upload.ClientError{Name: "TypeError", Message: "Network request failed"}}
	}
	report := upload.FailureReport{
		SessionID: &session.ID,
		Stage:     upload.FailureSending,
		Reason:    "rejected",
		Error:     upload.ClientError{Name: "ApiError", Message: "Forbidden", Status: ptr(403), Ray: ptr("a4a581a96a8ce353-NRT")},
		Chunk:     ptr(0),
		FileName:  "game.zip",
		FileSize:  12,
		Attempts:  attempts,
		Client:    "client-1",
		IP:        "2409:8a10::1",
		UserAgent: "browser",
	}

	id, err := f.service.ReportFailure(ctx, uploader, report)
	if err != nil || id != 1 {
		t.Fatalf("recorded %d %v", id, err)
	}
	got := f.repo.Failures[0]
	if got.UserID != uploader.UserID || !got.At.Equal(now) || *got.Report.SessionID != session.ID || *got.Report.Error.Ray != "a4a581a96a8ce353-NRT" {
		t.Fatalf("record %+v", got)
	}
	if kept := got.Report.Attempts; len(kept) != upload.MaxFailureAttempts || !kept[0].At.Equal(now.Add(2*time.Second)) {
		t.Fatalf("only the last attempts are kept: %d from %v", len(kept), kept[0].At)
	}

	expectCode(t, second(f.service.ReportFailure(ctx, stranger, report)), upload.ErrSessionNotOwner)

	gone := report
	gone.SessionID = ptr(404)
	if _, err := f.service.ReportFailure(ctx, uploader, gone); err != nil || f.repo.Failures[1].Report.SessionID != nil {
		t.Fatalf("a session that is gone is left out of the record: %v %+v", err, f.repo.Failures[1].Report.SessionID)
	}

	unopened := report
	unopened.SessionID = nil
	unopened.Stage = upload.FailureReading
	if _, err := f.service.ReportFailure(ctx, uploader, unopened); err != nil || len(f.repo.Failures) != 3 {
		t.Fatalf("a failure before any session is recorded: %v", err)
	}
}

func second[A, B any](_ A, b B) B {
	return b
}

func TestAnUploadRecordsWhenItsStepsHappened(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	content := []byte("0123456789")
	session := f.startUpload(t, content)
	f.sendChunks(t, session, content)
	if err := f.service.Complete(ctx, uploader, "", session.ID, uploadtest.Digest(content)); err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.Claim(ctx, uploader, session.ID); err != nil {
		t.Fatal(err)
	}
	got, _ := f.repo.GetSession(ctx, session.ID)
	if got.LastChunkAt == nil || got.CompletedAt == nil || got.SubmittedAt == nil || got.AbortedAt != nil || got.EndedAt != nil {
		t.Fatalf("milestones %+v", got)
	}
	cancelled := f.startUpload(t, []byte("0123"))
	if err := f.service.Abort(ctx, uploader, "", cancelled.ID); err != nil {
		t.Fatal(err)
	}
	if err := f.service.CleanStaleSessions(ctx); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetSession(ctx, cancelled.ID); got.Status != upload.StatusExpired || got.AbortedAt == nil || got.EndedAt == nil {
		t.Fatalf("a cancelled upload keeps when it was cancelled: %+v", got)
	}
}

func TestAnEndedUploadIsExpiredForItsUploader(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	content := []byte("0123")
	session := f.startUpload(t, content)
	if err := f.service.Terminate(ctx, session.ID); err != nil {
		t.Fatal(err)
	}
	chunk := upload.Chunk{SHA256: uploadtest.Digest(content), ContentLength: int64(len(content))}
	expectCode(t, f.service.WriteChunk(ctx, uploader, "", session.ID, 0, chunk, bytes.NewReader(content)), upload.ErrSessionExpired)
	expectCode(t, f.service.Complete(ctx, uploader, "", session.ID, uploadtest.Digest(content)), upload.ErrSessionExpired)
	_, err := f.service.Status(ctx, uploader, session.ID)
	expectCode(t, err, upload.ErrSessionExpired)
}

func TestAdminsTerminateUploadsInProgressOrNotYetSubmitted(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	uploading := f.startUpload(t, []byte("0123456789"))
	f.spool.Put(uploading.StoragePath, []byte("01"), now)
	finished := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("finished")})
	submitted := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("submitted"), SubmittedAt: ptr(now)})
	attached := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("attached")})
	f.repo.AttachFile(attached.ID, attached.StoragePath)
	late := f.repo.Seed(upload.Session{Status: upload.StatusUploading, CreatorID: uploader.UserID, ExpiresAt: now.Add(-time.Minute)})

	for _, id := range []int{uploading.ID, finished.ID} {
		if err := f.service.Terminate(ctx, id); err != nil {
			t.Fatalf("terminate %d: %v", id, err)
		}
		if got, _ := f.repo.GetSession(ctx, id); got.Status != upload.StatusAborted || got.AbortedAt == nil {
			t.Fatalf("terminated %+v", got)
		}
	}
	if _, ok := f.spool.Content(uploading.StoragePath); ok {
		t.Fatal("the uploaded part is discarded")
	}
	expectCode(t, f.service.Terminate(ctx, submitted.ID), upload.ErrSessionAlreadyUsed)
	expectCode(t, f.service.Terminate(ctx, attached.ID), upload.ErrSessionAlreadyUsed)
	expectCode(t, f.service.Terminate(ctx, late.ID), upload.ErrSessionExpired)
	expectCode(t, f.service.Terminate(ctx, uploading.ID), upload.ErrInvalidSessionStatus)
	expectCode(t, f.service.Terminate(ctx, 999), upload.ErrSessionNotFound)
}

func TestASubmittedUploadIsNeitherLeftOverNorCleanedUp(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	replaced := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, CreatorID: uploader.UserID, StoragePath: f.spool.Path("old"), Updated: now.Add(-7 * time.Hour), SubmittedAt: ptr(now.Add(-8 * time.Hour))})
	if err := f.service.CleanStaleSessions(ctx); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetSession(ctx, replaced.ID); got.Status != upload.StatusCompleted {
		t.Fatalf("a submitted upload whose file was replaced stays as it was: %+v", got)
	}
	ongoing, err := f.service.Ongoing(ctx, uploader, "")
	if err != nil || len(ongoing) != 0 {
		t.Fatalf("it is not offered to the uploader again: %+v %v", ongoing, err)
	}
}

func TestASubmissionFailureIsRecordedUnderEachUploadItNames(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	one := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, FileName: "part1.rar", TotalSize: 10, CreatorID: uploader.UserID})
	two := f.repo.Seed(upload.Session{Status: upload.StatusCompleted, FileName: "part2.rar", TotalSize: 6, CreatorID: uploader.UserID})
	report := upload.FailureReport{
		SessionIDs: []int{one.ID, 404, two.ID},
		Stage:      upload.FailureSubmitting,
		Reason:     "rejected",
		Error:      upload.ClientError{Name: "ApiError", Message: "Conflict", Status: ptr(409)},
		FileName:   "Windows 简体中文",
		FileSize:   16,
	}
	id, err := f.service.ReportFailure(ctx, uploader, report)
	if err != nil || id != 1 || len(f.repo.Failures) != 2 {
		t.Fatalf("recorded %d %v %d", id, err, len(f.repo.Failures))
	}
	for i, session := range []upload.Session{one, two} {
		got := f.repo.Failures[i].Report
		if *got.SessionID != session.ID || got.FileName != session.FileName || got.FileSize != session.TotalSize || got.SessionIDs != nil {
			t.Fatalf("failure %d %+v", i, got)
		}
	}
	nobody := report
	nobody.SessionIDs = []int{404}
	if _, err := f.service.ReportFailure(ctx, uploader, nobody); err != nil || f.repo.Failures[2].Report.SessionID != nil || f.repo.Failures[2].Report.FileName != "Windows 简体中文" {
		t.Fatalf("with no upload left the failure stands alone: %v %+v", err, f.repo.Failures[2].Report)
	}
	expectCode(t, second(f.service.ReportFailure(ctx, stranger, report)), upload.ErrSessionNotOwner)
}
