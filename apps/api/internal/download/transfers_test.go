package download_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

type transferFixture struct {
	repo      *downloadtest.MemoryRepository
	store     *downloadtest.ObjectStore
	spool     *uploadtest.MemorySpool
	quota     *quota
	events    *downloadtest.Recorder
	transfers *download.Transfers
}

func newTransferFixture() transferFixture {
	f := transferFixture{
		repo:   downloadtest.NewMemoryRepository(func() time.Time { return now }),
		store:  downloadtest.NewObjectStore(),
		spool:  uploadtest.NewMemorySpool(),
		quota:  &quota{},
		events: &downloadtest.Recorder{},
	}
	f.transfers = download.NewTransfers(f.repo, f.store, f.spool, f.quota, f.events, f.events, &txtest.Immediate{}, func() time.Time { return now })
	return f
}

func TestStorageKeyIsSanitized(t *testing.T) {
	cases := map[string]string{
		"ゲーム 体験版 (v1.2).7z":    "games/10/7/ゲーム_体験版_v1.2_.7z",
		"../../etc/passwd":     "games/10/7/passwd",
		"ｆｕｌｌｗｉｄｔｈ.zip":        "games/10/7/fullwidth.zip",
		"a&b+c=d.rar":          "games/10/7/a_b_c_d.rar",
		"already-safe_name.7z": "games/10/7/already-safe_name.7z",
	}
	for name, want := range cases {
		if got := download.StorageKey(10, 7, name); got != want {
			t.Fatalf("%q: got %s want %s", name, got, want)
		}
	}
}

func TestStoreUploadsAndFinalizes(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	path := f.spool.Path("5")
	f.spool.Put(path, []byte("archive"), now)
	session := 5
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "Game v1.7z", Size: 7, Hash: "b3", Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK, UploadSessionID: &session, CreatorID: 1})
	f.repo.Strikes[1] = 2

	if err := f.transfers.Store(ctx, file.ID); err != nil {
		t.Fatal(err)
	}
	key := "games/10/1/Game_v1.7z"
	object, ok := f.store.Objects[key]
	if !ok || object.LocalPath != path || object.ContentType != "application/octet-stream" || object.Metadata["game-id"] != "10" || object.Metadata["uploader-id"] != "1" || object.Metadata["file-sha256"] != "b3" {
		t.Fatalf("uploaded object %+v", f.store.Objects)
	}
	stored, _ := f.repo.GetFile(ctx, file.ID)
	if stored.Status != download.FileInObjectStore || *stored.StorageKey != key {
		t.Fatalf("file %+v", stored)
	}
	histories := f.repo.Histories(file.ID)
	if len(histories) != 1 || *histories[0].StorageKey != key || histories[0].OperatorID != 1 || *histories[0].UploadSessionID != 5 {
		t.Fatalf("first upload creates the history entry: %+v", histories)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileUploadToS3 || *recorded[0].FileStatus != download.FileInObjectStore || *recorded[0].FileCheckStatus != 1 || recorded[0].FileSize != nil {
		t.Fatalf("activity %+v", recorded)
	}
	messages := f.events.Messages()
	var meta map[string]any
	if len(messages) != 1 || messages[0].ReceiverID != 1 || json.Unmarshal(messages[0].Meta, &meta) != nil || meta["file_name"] != "Game v1.7z" {
		t.Fatalf("message %+v", messages)
	}
	if f.repo.Strikes[1] != 0 {
		t.Fatal("a successful upload resets malware strikes")
	}
	if _, ok := f.spool.Content(path); ok {
		t.Fatal("the local copy is removed")
	}
	if err := f.transfers.Store(ctx, file.ID); err != nil || len(f.events.Activities()) != 1 {
		t.Fatalf("storing again is a no-op: %v", err)
	}
}

func TestStoreUpdatesTheLatestHistoryOnReupload(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	path := f.spool.Path("6")
	f.spool.Put(path, []byte("x"), now)
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "a.7z", Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1})
	f.repo.SeedHistory(download.History{FileID: file.ID, OperatorID: 1, Created: now.Add(-time.Hour)})
	f.repo.SeedHistory(download.History{FileID: file.ID, OperatorID: 2, Created: now})
	if err := f.transfers.Store(ctx, file.ID); err != nil {
		t.Fatal(err)
	}
	histories := f.repo.Histories(file.ID)
	if len(histories) != 2 || histories[0].StorageKey != nil || histories[1].StorageKey == nil {
		t.Fatalf("only the newest history gets the key: %+v", histories)
	}
}

func TestStoreRefusesUnapprovedOrMissingFiles(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	path := f.spool.Path("7")
	pending := f.repo.SeedFile(download.File{ResourceID: resource.ID, Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckPending})
	if err := f.transfers.Store(ctx, pending.ID); !errors.Is(err, download.ErrFileNotReadyForStore) {
		t.Fatalf("unapproved: %v", err)
	}
	missing := f.repo.SeedFile(download.File{ResourceID: resource.ID, Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK})
	if err := f.transfers.Store(ctx, missing.ID); !errors.Is(err, download.ErrLocalFileMissing) {
		t.Fatalf("missing local file: %v", err)
	}
	if err := f.transfers.Store(ctx, 999); err != nil {
		t.Fatalf("deleted files are skipped: %v", err)
	}
	f.spool.Put(path, []byte("x"), now)
	f.store.PutErr = errors.New("storage down")
	if err := f.transfers.Store(ctx, missing.ID); err == nil {
		t.Fatal("storage failures are retried")
	}
	if got, _ := f.repo.GetFile(ctx, missing.ID); got.Status != download.FileOnServer {
		t.Fatalf("failed uploads leave the file pending: %+v", got)
	}
}

func TestPurgeDeletesOnlyOlderVersions(t *testing.T) {
	f := newTransferFixture()
	if err := f.transfers.Purge(context.Background(), download.PurgeObjects{Keys: []string{"a", "b"}, Before: now}); err != nil {
		t.Fatal(err)
	}
	if !f.store.Purged["a"].Equal(now) || !f.store.Purged["b"].Equal(now) {
		t.Fatalf("purged %v", f.store.Purged)
	}
}

func TestCleanFilesHandlesStoredAndRejectedFiles(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	keep := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	storedPath, outsidePath := f.spool.Path("stored"), "/elsewhere/file"
	f.spool.Put(storedPath, []byte("x"), now)
	stored := f.repo.SeedFile(download.File{ResourceID: keep.ID, Path: &storedPath, Status: download.FileInObjectStore})
	outside := f.repo.SeedFile(download.File{ResourceID: keep.ID, Path: &outsidePath, Status: download.FileInObjectStore})
	brokenPath := f.spool.Path("broken")
	f.spool.Put(brokenPath, []byte("x"), now)
	session := 9
	broken := f.repo.SeedFile(download.File{ResourceID: keep.ID, Path: &brokenPath, Status: download.FileOnServer, CheckStatus: download.CheckEncrypted, UploadSessionID: &session, CreatorID: 3})
	lonely := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	lonelyFile := f.repo.SeedFile(download.File{ResourceID: lonely.ID, Status: download.FileOnServer, CheckStatus: download.CheckBrokenOrTruncated})
	review := f.repo.SeedFile(download.File{ResourceID: keep.ID, Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview})

	if err := f.transfers.CleanFiles(ctx); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetFile(ctx, stored.ID); got.Path != nil {
		t.Fatalf("stored files drop their local path: %+v", got)
	}
	if got, _ := f.repo.GetFile(ctx, outside.ID); got.Path == nil {
		t.Fatal("paths outside the upload root are left alone")
	}
	if _, err := f.repo.GetFile(ctx, broken.ID); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatal("rejected files are deleted")
	}
	if _, err := f.repo.GetResource(ctx, keep.ID); err != nil {
		t.Fatal("resources with healthy files are kept")
	}
	if _, err := f.repo.GetFile(ctx, lonelyFile.ID); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatal("lonely rejected file is deleted")
	}
	if _, err := f.repo.GetResource(ctx, lonely.ID); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatal("resources left without files are deleted")
	}
	if _, err := f.repo.GetFile(ctx, review.ID); err != nil {
		t.Fatal("files pending malware review are not cleaned")
	}
	if !slices.Equal(f.quota.withdrawn, []withdrawal{{UserID: 3, SessionID: 9}}) {
		t.Fatalf("rejected uploads are refunded: %+v", f.quota.withdrawn)
	}
	if removed := f.spool.Removed(); !slices.Contains(removed, storedPath) || !slices.Contains(removed, brokenPath) || slices.Contains(removed, outsidePath) {
		t.Fatalf("removed %v", removed)
	}
}
