package download_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

type transferFixture struct {
	repo      *downloadtest.MemoryRepository
	store     *downloadtest.ObjectStore
	spool     *uploadtest.MemorySpool
	events    *downloadtest.Recorder
	cards     *gametest.Cards
	media     downloadtest.Media
	transfers *download.TransferService
}

func newTransferFixture() transferFixture {
	f := transferFixture{
		repo:   downloadtest.NewMemoryRepository(func() time.Time { return now }),
		store:  downloadtest.NewObjectStore(),
		spool:  uploadtest.NewMemorySpool(),
		events: &downloadtest.Recorder{},
	}
	f.cards = gametest.NewCards(game.Card{ID: 10, TitleJP: "ゲーム"})
	f.media = downloadtest.Media{Formats: map[int]string{}}
	f.transfers = download.NewTransferService(f.repo, f.store, f.spool, f.events, f.events, downloadtest.Names(f.repo, f.cards, f.media), &txtest.Immediate{}, func() time.Time { return now })
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
	if len(messages) != 1 || messages[0].ReceiverID != 1 || messages[0].Title != "Messages.System.File.Upload.ResourcePublishedTitle" || messages[0].Meta["file_count"] != 1 {
		t.Fatalf("storing the only file publishes the resource with one message: %+v", messages)
	}
	if link := messages[0]; link.LinkURL == nil || link.LinkText == nil || *link.LinkText != "Messages.System.File.Upload.ResourceLinkText" || *link.LinkURL != fmt.Sprintf("/resource/%d", link.Meta["resource_id"]) {
		t.Fatalf("the notice leads to the page of the resource: %+v", link)
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

func TestStoringAFileAddedAfterPublicationIsRecorded(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	published := now.Add(-time.Hour)
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1, PublishedAt: &published})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Status: download.FileInObjectStore, CreatorID: 1, Created: published.Add(-time.Minute)})
	replacedPath, addedPath := f.spool.Path("7"), f.spool.Path("8")
	f.spool.Put(replacedPath, []byte("x"), now)
	f.spool.Put(addedPath, []byte("xy"), now)
	replaced := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "patch.7z", Path: &replacedPath, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1, Created: published.Add(-time.Minute)})
	added := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "特典.zip", Size: 2, Path: &addedPath, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1, Created: now})

	for _, id := range []int{replaced.ID, added.ID} {
		if err := f.transfers.Store(ctx, id); err != nil {
			t.Fatal(err)
		}
	}
	events := f.repo.Events(resource.ID)
	if len(events) != 1 || events[0].Kind != download.EventFileAdded || events[0].Actor.ID != 1 || events[0].Data.Files[0] != (download.EventFile{Name: "特典.zip", Size: 2}) {
		t.Fatalf("only the file that joined after publication counts as added: %+v", events)
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
	f.store.PutErr = nil
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1, Status: download.ResourceRemoved})
	takenDown := f.repo.SeedFile(download.File{ResourceID: removed.ID, Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK})
	if err := f.transfers.Store(ctx, takenDown.ID); err != nil || len(f.events.Messages()) != 0 {
		t.Fatalf("files of removed resources are not stored: %v %+v", err, f.events.Messages())
	}
	if got, _ := f.repo.GetFile(ctx, takenDown.ID); got.Status != download.FileOnServer || got.StorageKey != nil {
		t.Fatalf("the file stays on the server for the cleanup: %+v", got)
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
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1, Status: download.ResourceRemoved})
	takenDownPath := f.spool.Path("taken")
	f.spool.Put(takenDownPath, []byte("x"), now)
	takenDown := f.repo.SeedFile(download.File{ResourceID: removed.ID, Path: &takenDownPath, Status: download.FileOnServer, CheckStatus: download.CheckOK})

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
	if got, _ := f.repo.GetFile(ctx, takenDown.ID); got.Path != nil {
		t.Fatalf("files of removed resources drop their local copy: %+v", got)
	}
	if removedPaths := f.spool.Removed(); !slices.Contains(removedPaths, storedPath) || !slices.Contains(removedPaths, brokenPath) || !slices.Contains(removedPaths, takenDownPath) || slices.Contains(removedPaths, outsidePath) {
		t.Fatalf("removed %v", removedPaths)
	}
}

func TestStorePublishesTheResourceWithItsLastFile(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	var files []download.File
	for _, name := range []string{"game.part1.rar", "game.part2.rar"} {
		path := f.spool.Path(name)
		f.spool.Put(path, []byte(name), now)
		files = append(files, f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: name, Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1}))
	}
	if err := f.transfers.Store(ctx, files[0].ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); got.Published() || len(f.events.Messages()) != 0 {
		t.Fatal("a resource is not published, and nothing is announced, while one of its files is still on the server")
	}
	if err := f.transfers.Store(ctx, files[1].ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); !got.Published() || !got.PublishedAt.Equal(now) {
		t.Fatalf("storing the last file publishes the resource: %+v", got)
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].Content != "Messages.System.File.Upload.ResourcePublishedContent" || !slices.Equal(messages[0].Meta["file_names"].([]string), []string{"game.part1.rar", "game.part2.rar"}) {
		t.Fatalf("one message announces the published resource: %+v", messages)
	}
	path := f.spool.Path("bonus.zip")
	f.spool.Put(path, []byte("bonus"), now)
	bonus := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "bonus.zip", Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1})
	if err := f.transfers.Store(ctx, bonus.ID); err != nil {
		t.Fatal(err)
	}
	if messages := f.events.Messages(); len(messages) != 2 || messages[1].Title != "Messages.System.File.Upload.FileUploadSuccessTitle" || messages[1].Meta["file_name"] != "bonus.zip" {
		t.Fatalf("files added to a published resource are announced one by one: %+v", messages)
	}
}

func TestCleaningARejectedFilePublishesTheRest(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Status: download.FileInObjectStore, CheckStatus: download.CheckOK})
	set := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "extra.part1.rar", Status: download.FileOnServer, CheckStatus: download.CheckIncompleteSet})
	if err := f.transfers.CleanFiles(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.GetFile(ctx, set.ID); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("files of an incomplete set are rejected like any other: %v", err)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); !got.Published() {
		t.Fatal("once the rejected file is gone, the stored rest is published")
	}
	if messages := f.events.Messages(); len(messages) != 1 || messages[0].Title != "Messages.System.File.Upload.ResourcePublishedTitle" || messages[0].ReceiverID != 1 {
		t.Fatalf("the uploader hears about the publication: %+v", messages)
	}
}

func TestStoringTheLastFilePublishesItUnderItsCanonicalName(t *testing.T) {
	ctx := context.Background()
	f := newTransferFixture()
	portable := download.FormPortable
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: 1, Languages: []string{"jp"}, Canonical: true, Info: download.Info{Form: &portable}})
	path := f.spool.Path("5")
	f.spool.Put(path, []byte("archive"), now)
	uploaded := "upload.7z"
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: uploaded, OriginalName: &uploaded, Size: 7, Hash: "b3", Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1})
	if err := f.transfers.Store(ctx, file.ID); err != nil {
		t.Fatal(err)
	}
	stored, _ := f.repo.GetFile(ctx, file.ID)
	if stored.Name != "ゲーム (files).7z" || *stored.OriginalName != uploaded {
		t.Fatalf("the published file takes the canonical name: %+v", stored)
	}
	events, _ := f.repo.ListEvents(ctx, resource.ID, 10)
	if len(events) != 1 || events[0].Kind != download.EventPublished || events[0].Data.Files[0].Name != "ゲーム (files).7z" {
		t.Fatalf("the history shows the name people download: %+v", events)
	}
	messages := f.events.Messages()
	if names, _ := messages[0].Meta["file_names"].([]string); len(names) != 1 || names[0] != "ゲーム (files).7z" {
		t.Fatalf("the notice names the published file: %+v", messages[0].Meta)
	}

	added := "bonus.zip"
	extraPath := f.spool.Path("6")
	f.spool.Put(extraPath, []byte("bonus"), now)
	extra := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: added, OriginalName: &added, Size: 5, Hash: "b3", Path: &extraPath, Status: download.FileOnServer, CheckStatus: download.CheckOK, CreatorID: 1})
	if err := f.transfers.Store(ctx, extra.ID); err != nil {
		t.Fatal(err)
	}
	if kept, _ := f.repo.GetFile(ctx, extra.ID); kept.Name != added {
		t.Fatalf("a file added later keeps its own name: %+v", kept)
	}
}
