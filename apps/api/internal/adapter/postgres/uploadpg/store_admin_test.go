package uploadpg_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var _ download.UploadStore = (*uploadpg.AdminStore)(nil)

type adminFixture struct {
	ctx   context.Context
	db    *pgtest.DB
	repo  *uploadpg.Repository
	store *uploadpg.AdminStore
	user  int
	game  int
	n     int
}

func newAdminFixture(t *testing.T) *adminFixture {
	db := pgtest.New(t)
	return &adminFixture{ctx: context.Background(), db: db, repo: uploadpg.NewRepository(db.Ent), store: uploadpg.NewAdminStore(db.Ent), user: db.User(t), game: db.Game(t)}
}

func (f *adminFixture) session(t *testing.T, name string, edit func(*ent.GameUploadSessionUpdateOne)) int {
	t.Helper()
	f.n++
	created, err := f.repo.CreateSession(f.ctx, upload.NewSession{FileName: name, TotalSize: 100, ChunkSize: 40, TotalChunks: 3, StoragePath: "/spool/" + name, ExpiresAt: time.Now().Add(time.Hour), CreatorID: f.user})
	if err != nil {
		t.Fatal(err)
	}
	if edit != nil {
		update := f.db.Ent.GameUploadSession.UpdateOneID(created.ID)
		edit(update)
		update.ExecX(f.ctx)
	}
	if _, err := f.db.Ent.ExecContext(f.ctx, `UPDATE game_upload_sessions SET created = $1 WHERE id = $2`, base.Add(time.Duration(f.n)*time.Minute), created.ID); err != nil {
		t.Fatal(err)
	}
	return created.ID
}

func (f *adminFixture) file(t *testing.T, sessionID, status, check int) int {
	t.Helper()
	resource := f.db.Ent.GameDownloadResource.Create().SetGameID(f.game).SetCreatorID(f.user).SetPlatform(pgvalue.Strings{"win"}).SetLanguage(pgvalue.Strings{"jp"}).SaveX(f.ctx)
	return f.db.Ent.GameDownloadResourceFile.Create().SetGameDownloadResourceID(resource.ID).SetType(download.FileTypeObjectStore).
		SetFileName("file").SetFileSize(100).SetFileHash("hash").SetFileStatus(status).SetFileCheckStatus(check).
		SetCreatorID(f.user).SetUploadSessionID(sessionID).SaveX(f.ctx).ID
}

func TestUploadsAreListedInTheStageTheRuleGivesThem(t *testing.T) {
	f := newAdminFixture(t)
	past := time.Now().UTC().Add(-time.Hour)
	f.session(t, "uploading.7z", nil)
	f.session(t, "late.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetExpiresAt(past) })
	f.session(t, "pending.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetCompletedAt(past) })
	f.session(t, "cancelled.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("EXPIRED").SetAbortedAt(past).SetEndedAt(past) })
	f.session(t, "expired.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("EXPIRED").SetEndedAt(past) })
	f.session(t, "replaced.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(past) })
	checking := f.session(t, "checking.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(past) })
	f.file(t, checking, download.FileOnServer, int(download.CheckPending))
	review := f.session(t, "review.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(past) })
	f.file(t, review, download.FileInObjectStore, int(download.CheckHarmfulPendingReview))
	stored := f.session(t, "stored.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(past) })
	f.file(t, stored, download.FileInObjectStore, int(download.CheckOK))
	encrypted := f.session(t, "encrypted.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(past) })
	f.file(t, encrypted, download.FileOnServer, int(download.CheckEncrypted))
	if _, err := f.repo.RecordFailure(f.ctx, f.user, upload.FailureReport{Stage: upload.FailureReading, Reason: "unreadable", Error: upload.ClientError{Name: "NotFoundError"}, FileName: "unread.7z", FileSize: 5}, base.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	page := download.Page{Number: 1, Size: 50}
	all, total, err := f.store.Uploads(f.ctx, download.UploadFilter{Now: now}, page)
	if err != nil || total != 11 || len(all) != 11 {
		t.Fatalf("all %d %d %v", len(all), total, err)
	}
	if all[0].Kind != download.UploadAttempt || all[0].FileName != "unread.7z" || all[0].FailureCount != 1 || all[0].Session != nil {
		t.Fatalf("the newest is the failure without a session: %+v", all[0])
	}
	want := map[download.UploadStage]int{
		download.UploadNotStarted: 1, download.UploadUploading: 1, download.UploadExpired: 2, download.UploadPending: 1, download.UploadCanceled: 1,
		download.UploadPublished: 2, download.UploadProcessing: 2, download.UploadRejected: 1,
	}
	for _, stage := range download.UploadStages() {
		listed, count, err := f.store.Uploads(f.ctx, download.UploadFilter{Stage: &stage, Now: now}, page)
		if err != nil || count != want[stage] || len(listed) != want[stage] {
			t.Fatalf("%s: %d listed, %d counted, %v", stage, len(listed), count, err)
		}
		for _, entry := range listed {
			if got := download.StageOfUpload(entry.Session, entry.Target, now); got != stage {
				t.Fatalf("%s listed under %s, but the rule gives %s", entry.FileName, stage, got)
			}
		}
	}
}

func TestUploadsAreFilteredAndPaged(t *testing.T) {
	f := newAdminFixture(t)
	other := f.db.User(t)
	first := f.session(t, "Senren_Banka.7z", nil)
	f.session(t, "Riddle_Joker.7z", nil)
	f.db.Ent.GameUploadSession.Create().SetFileName("theirs.7z").SetTotalSize(1).SetChunkSize(1).SetTotalChunks(1).SetFileSha256("").
		SetStatus("UPLOADING").SetStoragePath("/spool/theirs").SetExpiresAt(time.Now().UTC().Add(time.Hour)).SetCreatorID(other).SetCreated(base).ExecX(f.ctx)
	if _, err := f.repo.RecordFailure(f.ctx, f.user, upload.FailureReport{SessionID: &first, Stage: upload.FailureSending, Reason: "rejected", Error: upload.ClientError{Name: "ApiError"}, FileName: "Senren_Banka.7z"}, base); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	cases := []struct {
		name   string
		filter download.UploadFilter
		want   []string
	}{
		{"by file name, wildcards taken literally", download.UploadFilter{Query: "_banka", Now: now}, []string{"Senren_Banka.7z"}},
		{"a percent sign matches nothing", download.UploadFilter{Query: "%", Now: now}, nil},
		{"by uploader", download.UploadFilter{UserID: &other, Now: now}, []string{"theirs.7z"}},
		{"only with failures", download.UploadFilter{FailedOnly: true, Now: now}, []string{"Senren_Banka.7z"}},
	}
	for _, c := range cases {
		listed, _, err := f.store.Uploads(f.ctx, c.filter, download.Page{Number: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		var names []string
		for _, entry := range listed {
			names = append(names, entry.FileName)
		}
		if len(names) != len(c.want) || (len(names) > 0 && names[0] != c.want[0]) {
			t.Fatalf("%s: %v", c.name, names)
		}
	}
	second, total, err := f.store.Uploads(f.ctx, download.UploadFilter{Now: now}, download.Page{Number: 2, Size: 2})
	if err != nil || total != 3 || len(second) != 1 || second[0].FileName != "theirs.7z" {
		t.Fatalf("page 2: %+v %d %v", second, total, err)
	}
}

func TestAnUploadIsReadWithItsFileAndFailures(t *testing.T) {
	f := newAdminFixture(t)
	id := f.session(t, "stored.7z", func(u *ent.GameUploadSessionUpdateOne) { u.SetStatus("COMPLETED").SetSubmittedAt(base) })
	fileID := f.file(t, id, download.FileInObjectStore, int(download.CheckOK))
	_ = f.repo.AddChunk(f.ctx, id, 0, time.Now().Add(time.Hour))
	_ = f.repo.AddChunk(f.ctx, id, 2, time.Now().Add(time.Hour))
	status, ray := 403, "8f3c2a1b9d7e4c21-HKG"
	for i, stage := range []upload.FailureStage{upload.FailureReading, upload.FailureSending} {
		report := upload.FailureReport{SessionID: &id, Stage: stage, Reason: "rejected", Error: upload.ClientError{Name: "ApiError", Status: &status, Ray: &ray},
			Attempts: []upload.FailureAttempt{{At: base, Wait: "network", Error: upload.ClientError{Name: "TypeError", Message: "Failed to fetch"}}}, Client: "c41e", IP: "2409::1", UserAgent: "Chrome"}
		if _, err := f.repo.RecordFailure(f.ctx, f.user, report, base.Add(time.Duration(i)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	detail, err := f.store.SessionUpload(f.ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Kind != download.UploadSession || detail.Session.ReceivedChunks() != 2 || detail.Session.SubmittedAt == nil || detail.Target == nil ||
		detail.Target.FileID != fileID || detail.Target.Game.ID != f.game || detail.FailureCount != 2 || len(detail.Failures) != 2 {
		t.Fatalf("detail %+v %+v", detail.Upload, detail.Target)
	}
	newest := detail.Failures[0]
	if newest.Stage != upload.FailureSending || *newest.Error.Ray != ray || newest.Attempts[0].Error.Message != "Failed to fetch" || newest.IP != "2409::1" {
		t.Fatalf("newest failure %+v", newest)
	}
	if _, err := f.store.SessionUpload(f.ctx, 987654); !errors.Is(err, upload.ErrSessionNotFound) {
		t.Fatalf("missing session: %v", err)
	}
	attempt, err := f.repo.RecordFailure(f.ctx, f.user, upload.FailureReport{Stage: upload.FailureReading, Reason: "unreadable", Error: upload.ClientError{Name: "NotReadableError"}, FileName: "x.7z", FileSize: 9}, base)
	if err != nil {
		t.Fatal(err)
	}
	read, err := f.store.AttemptUpload(f.ctx, attempt)
	if err != nil || read.Kind != download.UploadAttempt || len(read.Failures) != 1 || read.Failures[0].Error.Name != "NotReadableError" {
		t.Fatalf("attempt %+v %v", read, err)
	}
	if _, err := f.store.AttemptUpload(f.ctx, detail.Failures[0].ID); !errors.Is(err, upload.ErrFailureNotFound) {
		t.Fatalf("a failure with a session is not an attempt: %v", err)
	}
}
