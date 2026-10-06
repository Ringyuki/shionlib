package download_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	owner      = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitNeverShow}
	other      = actor.Actor{UserID: 2, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	admin      = actor.Actor{UserID: 3, Role: actor.RoleAdmin}
	superAdmin = actor.Actor{UserID: 4, Role: actor.RoleSuperAdmin}
	now        = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
)

type sessions struct {
	byID map[int]upload.Session
}

func (s *sessions) Claim(_ context.Context, who actor.Actor, id int) (upload.Session, error) {
	session, ok := s.byID[id]
	switch {
	case !ok:
		return upload.Session{}, upload.ErrSessionNotFound
	case session.Status != upload.StatusCompleted:
		return upload.Session{}, upload.ErrInvalidSessionStatus
	case session.CreatorID != who.UserID:
		return upload.Session{}, upload.ErrSessionNotOwner
	}
	return session, nil
}

type fixture struct {
	repo     *downloadtest.MemoryRepository
	spool    *uploadtest.MemorySpool
	sessions *sessions
	events   *downloadtest.Recorder
	store    *downloadtest.ObjectStore
	service  *download.Service
}

func newFixture() fixture {
	repo := downloadtest.NewMemoryRepository(func() time.Time { return now })
	f := fixture{
		repo:     repo,
		spool:    uploadtest.NewMemorySpool(),
		sessions: &sessions{byID: map[int]upload.Session{}},
		events:   &downloadtest.Recorder{},
		store:    downloadtest.NewObjectStore(),
	}
	cards := gametest.NewCards(game.Card{ID: 10, TitleJP: "ゲーム", TitleZH: "游戏", TitleEN: "Game"}, game.Card{ID: 11})
	f.service = download.NewService(download.Deps{
		Repo:       repo,
		Games:      cards,
		Sessions:   f.sessions,
		Activities: f.events,
		Messages:   f.events,
		Tx:         &txtest.Immediate{},
		Queue:      f.events,
		Store:      f.store,
		Local:      f.spool,
		Settings:   settingtest.Set(settingtest.Source{}, download.MaxFilesPerResource, 3),
		Now:        func() time.Time { return now },
	})
	return f
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

func TestGameResourcesHidesUnfinishedFilesFromOthers(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	stored := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	storedFile := f.repo.SeedFile(download.File{ResourceID: stored.ID, Name: "a.7z", Status: download.FileInObjectStore, CreatorID: owner.UserID})
	pending := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: pending.ID, Name: "b.7z", Status: download.FileOnServer, CreatorID: owner.UserID})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved})
	f.repo.SeedFile(download.File{ResourceID: removed.ID, Status: download.FileInObjectStore, CreatorID: owner.UserID})
	f.repo.SeedHistory(download.History{FileID: storedFile.ID, OperatorID: owner.UserID, Created: now.Add(-time.Hour)})

	if _, err := f.service.GameResources(ctx, other, 404); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	seen, err := f.service.GameResources(ctx, other, 10)
	if err != nil || len(seen) != 1 || seen[0].ID != stored.ID {
		t.Fatalf("others only see published resources: %+v %v", seen, err)
	}
	if seen[0].Files[0].LatestReupload() != nil {
		t.Fatal("a single history entry is the original upload, not a re-upload")
	}
	mine, _ := f.service.GameResources(ctx, owner, 10)
	if len(mine) != 2 {
		t.Fatalf("creators see their unpublished resources: %+v", mine)
	}
	f.repo.SeedHistory(download.History{FileID: storedFile.ID, OperatorID: admin.UserID, Reason: ptr("fix"), Created: now})
	again, _ := f.service.GameResources(ctx, other, 10)
	if latest := again[0].Files[0].LatestReupload(); latest == nil || latest.OperatorID != admin.UserID || *latest.Reason != "fix" {
		t.Fatalf("latest re-upload: %+v", latest)
	}
}

func (f fixture) completed(id int, name string, size int64) {
	f.sessions.byID[id] = upload.Session{ID: id, Status: upload.StatusCompleted, CreatorID: owner.UserID, FileName: name, StoragePath: fmt.Sprintf("/spool/%d.part", id), TotalSize: size, HashAlgorithm: upload.HashBLAKE3, FileHash: fmt.Sprintf("b3-%d", id), MimeType: ptr("application/octet-stream")}
}

func TestCreateAttachesEveryUpload(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.completed(5, "game.part1.rar", 2048)
	f.completed(6, "game.part2.rar", 1024)
	f.sessions.byID[7] = upload.Session{ID: 7, Status: upload.StatusUploading, CreatorID: owner.UserID}
	input := download.CreateInput{Platforms: []string{"and"}, Languages: []string{"jp"}, Simulator: ptr("KRKR"), Files: []download.FileUpload{{UploadSessionID: 5}, {UploadSessionID: 6, Name: "第二卷.rar"}}}

	_, err := f.service.Create(ctx, owner, 404, input)
	expectCode(t, err, game.ErrNotFound)
	for _, tc := range []struct {
		files []download.FileUpload
		want  apperror.Definition
	}{
		{nil, apperror.ErrValidationFailed},
		{[]download.FileUpload{{UploadSessionID: 99}}, upload.ErrSessionNotFound},
		{[]download.FileUpload{{UploadSessionID: 7}}, upload.ErrInvalidSessionStatus},
		{[]download.FileUpload{{UploadSessionID: 5}, {UploadSessionID: 5}}, download.ErrSessionAlreadyUsed},
		{[]download.FileUpload{{UploadSessionID: 5}, {UploadSessionID: 6}, {UploadSessionID: 8}, {UploadSessionID: 9}}, download.ErrTooManyFiles},
	} {
		fresh := newFixture()
		fresh.completed(5, "game.part1.rar", 2048)
		fresh.completed(6, "game.part2.rar", 1024)
		fresh.sessions.byID[7] = f.sessions.byID[7]
		_, err := fresh.service.Create(ctx, owner, 10, download.CreateInput{Files: tc.files})
		expectCode(t, err, tc.want)
	}
	_, err = f.service.Create(ctx, other, 10, input)
	expectCode(t, err, upload.ErrSessionNotOwner)

	resource, err := f.service.Create(ctx, owner, 10, input)
	if err != nil {
		t.Fatal(err)
	}
	files, _ := f.repo.ListFiles(ctx, resource.ID)
	if resource.ID == 0 || resource.Published() || *resource.Simulator != "KRKR" || len(files) != 2 {
		t.Fatalf("resource %+v files %+v", resource, files)
	}
	if files[0].Name != "game.part1.rar" || *files[0].Path != "/spool/5.part" || files[0].Size != 2048 || files[0].Status != download.FileOnServer || files[0].CheckStatus != download.CheckPending || files[0].Hash != "b3-5" || *files[0].UploadSessionID != 5 {
		t.Fatalf("first file %+v", files[0])
	}
	if files[1].Name != "第二卷.rar" || *files[1].UploadSessionID != 6 {
		t.Fatalf("named file %+v", files[1])
	}
	recorded := f.events.Activities()
	if len(recorded) != 2 || recorded[0].Type != activity.TypeFileUploadToServer || *recorded[1].FileSize != 1024 || *recorded[1].GameID != 10 {
		t.Fatalf("activities %+v", recorded)
	}
	_, err = f.service.Create(ctx, owner, 11, download.CreateInput{Files: []download.FileUpload{{UploadSessionID: 6}}})
	expectCode(t, err, download.ErrSessionAlreadyUsed)
}

func TestAddFilesCountsTowardsTheLimit(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Status: download.FileInObjectStore, CreatorID: owner.UserID})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved})
	f.completed(5, "patch.zip", 10)
	f.completed(6, "ost.zip", 10)
	f.completed(7, "extra.zip", 10)

	expectCode(t, f.service.AddFiles(ctx, owner, 999, []download.FileUpload{{UploadSessionID: 5}}), download.ErrResourceNotFound)
	expectCode(t, f.service.AddFiles(ctx, owner, removed.ID, []download.FileUpload{{UploadSessionID: 5}}), download.ErrResourceNotFound)
	expectCode(t, f.service.AddFiles(ctx, other, resource.ID, []download.FileUpload{{UploadSessionID: 5}}), download.ErrResourceNotOwner)
	expectCode(t, f.service.AddFiles(ctx, owner, resource.ID, []download.FileUpload{{UploadSessionID: 5}, {UploadSessionID: 6}, {UploadSessionID: 7}}), download.ErrTooManyFiles)
	if err := f.service.AddFiles(ctx, owner, resource.ID, []download.FileUpload{{UploadSessionID: 5}, {UploadSessionID: 6}}); err != nil {
		t.Fatal(err)
	}
	if count, _ := f.repo.CountFiles(ctx, resource.ID); count != 3 {
		t.Fatalf("files after adding: %d", count)
	}
	seen, _ := f.service.GameResources(ctx, other, 10)
	if len(seen) != 1 || len(seen[0].Files) != 1 || seen[0].Files[0].Name != "game.7z" {
		t.Fatalf("a published resource stays visible while added files are checked: %+v", seen)
	}
}

func TestRenameFile(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "a.7z", CreatorID: owner.UserID})
	sibling := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "b.7z", CreatorID: owner.UserID})

	expectCode(t, f.service.RenameFile(ctx, owner, 999, "x.7z"), download.ErrFileNotFound)
	expectCode(t, f.service.RenameFile(ctx, other, file.ID, "x.7z"), download.ErrFileNotOwner)
	if err := f.service.RenameFile(ctx, admin, file.ID, "本体.7z"); err != nil {
		t.Fatal(err)
	}
	renamed, _ := f.repo.GetFile(ctx, file.ID)
	untouched, _ := f.repo.GetFile(ctx, sibling.ID)
	if renamed.Name != "本体.7z" || untouched.Name != "b.7z" {
		t.Fatalf("only the named file is renamed: %q %q", renamed.Name, untouched.Name)
	}
}

func TestDeleteFileKeepsTheLastOne(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	stored := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Status: download.FileInObjectStore, StorageKey: ptr("games/10/1/game.7z"), UploadSessionID: ptr(5), CreatorID: owner.UserID})
	pending := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "broken.7z", Status: download.FileOnServer, Path: ptr("/spool/6.part"), UploadSessionID: ptr(6), CreatorID: owner.UserID})
	f.spool.Put("/spool/6.part", []byte("x"), now)

	expectCode(t, f.service.DeleteFile(ctx, other, pending.ID), download.ErrFileNotOwner)
	if err := f.service.DeleteFile(ctx, owner, pending.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.GetFile(ctx, pending.ID); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("file removed: %v", err)
	}
	if !slices.Equal(f.spool.Removed(), []string{"/spool/6.part"}) {
		t.Fatalf("the local copy is released: %v", f.spool.Removed())
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); !got.Published() {
		t.Fatal("removing the last unfinished file publishes the resource")
	}
	expectCode(t, f.service.DeleteFile(ctx, owner, stored.ID), download.ErrLastFile)

	second := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "extra.7z", Status: download.FileInObjectStore, StorageKey: ptr("games/10/3/extra.7z"), CreatorID: owner.UserID})
	if err := f.service.DeleteFile(ctx, admin, second.ID); err != nil {
		t.Fatal(err)
	}
	jobs := f.events.Jobs()
	if purge, ok := jobs[len(jobs)-1].(download.PurgeObjects); !ok || !slices.Equal(purge.Keys, []string{"games/10/3/extra.7z"}) {
		t.Fatalf("stored objects are purged: %+v", jobs)
	}
}

func TestEditRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Note: ptr("old"), Simulator: ptr("ONS")})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "a.7z"})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved})
	changes := download.ResourceChanges{Platforms: []string{"win"}, Languages: []string{"zh"}}

	expectCode(t, f.service.Edit(ctx, owner, 999, changes), download.ErrResourceNotFound)
	expectCode(t, f.service.Edit(ctx, owner, removed.ID, changes), download.ErrResourceNotFound)
	expectCode(t, f.service.Edit(ctx, other, resource.ID, changes), download.ErrResourceNotOwner)
	if err := f.service.Edit(ctx, admin, resource.ID, changes); err != nil {
		t.Fatalf("admins may edit: %v", err)
	}
	got, _ := f.repo.GetResource(ctx, resource.ID)
	if got.Simulator != nil || *got.Note != "old" || !slices.Equal(got.Platforms, []string{"win"}) {
		t.Fatalf("edited %+v", got)
	}
}

func TestDeleteRequiresSuperAdminAndRemovesObjects(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, StorageKey: ptr("games/10/1/a.7z")})
	f.repo.SeedFile(download.File{ResourceID: resource.ID})

	expectCode(t, f.service.Delete(ctx, superAdmin, 999), download.ErrResourceNotFound)
	expectCode(t, f.service.Delete(ctx, admin, resource.ID), download.ErrResourceNotOwner)
	f.store.FailDelete("games/10/1/a.7z", errors.New("storage down"))
	if err := f.service.Delete(ctx, superAdmin, resource.ID); err == nil {
		t.Fatal("storage failures abort the deletion")
	}
	if _, err := f.repo.GetResource(ctx, resource.ID); err != nil {
		t.Fatal("resource must survive a failed storage deletion")
	}
	f.store.FailDelete("games/10/1/a.7z", nil)
	if err := f.service.Delete(ctx, superAdmin, resource.ID); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(f.store.Deleted, []string{"games/10/1/a.7z"}) {
		t.Fatalf("deleted keys %v", f.store.Deleted)
	}
	if _, err := f.repo.GetResource(ctx, resource.ID); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("resource must be gone: %v", err)
	}
}

func TestTakeDownSoftRemovesAndSchedulesPurge(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, StorageKey: ptr("games/10/1/a.7z")})
	keys, err := f.service.TakeDown(ctx, resource.ID)
	if err != nil || !slices.Equal(keys, []string{"games/10/1/a.7z"}) {
		t.Fatalf("take down %v %v", keys, err)
	}
	got, _ := f.repo.GetResource(ctx, resource.ID)
	if got.Status != download.ResourceRemoved || !got.Updated.Equal(now) {
		t.Fatalf("soft removal %+v", got)
	}
	if err := f.service.PurgeLater(ctx, keys); err != nil {
		t.Fatal(err)
	}
	jobs := f.events.Jobs()
	purge, ok := jobs[0].(download.PurgeObjects)
	if len(jobs) != 1 || !ok || !purge.Before.Equal(now) || !slices.Equal(purge.Keys, keys) {
		t.Fatalf("purge job %+v", jobs)
	}
	if _, err := f.service.TakeDown(ctx, 999); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("missing resource: %v", err)
	}
}

func TestMigrations(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	if _, err := f.service.MigrateResource(ctx, 404, download.MigrateResourceInput{}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	id, err := f.service.MigrateResource(ctx, 10, download.MigrateResourceInput{Platforms: []string{"win"}, Languages: []string{"jp"}})
	if err != nil || id == 0 {
		t.Fatal(err)
	}
	if resource, _ := f.repo.GetResource(ctx, id); resource.CreatorID != 1 {
		t.Fatalf("migrated resources belong to user 1: %+v", resource)
	}
	if err := f.service.MigrateFile(ctx, id, download.MigrateFileInput{FileName: "a.7z", FileSize: 3, FileHash: "h", ContentType: "application/x-7z", StorageKey: "games/10/9/a.7z"}); err != nil {
		t.Fatal(err)
	}
	files, _ := f.repo.ListFiles(ctx, id)
	if len(files) != 1 || files[0].Status != download.FileInObjectStore || files[0].HashAlgorithm != upload.HashBLAKE3 || *files[0].StorageKey != "games/10/9/a.7z" {
		t.Fatalf("migrated file %+v", files)
	}
	if resource, _ := f.repo.GetResource(ctx, id); !resource.Published() {
		t.Fatal("a resource whose imported files are all stored is published")
	}
	expectCode(t, f.service.MigrateFile(ctx, 999, download.MigrateFileInput{}), download.ErrResourceNotFound)
}

func TestReuploadRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	oldSession := 40
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "a.7z", Status: download.FileInObjectStore, StorageKey: ptr("games/10/1/a.7z"), UploadSessionID: &oldSession, CreatorID: owner.UserID})
	pending := f.repo.SeedFile(download.File{ResourceID: resource.ID, Status: download.FileOnServer, CreatorID: owner.UserID})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved})
	hidden := f.repo.SeedFile(download.File{ResourceID: removed.ID, Status: download.FileInObjectStore, CreatorID: owner.UserID})
	usedSession := 41
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Status: download.FileInObjectStore, UploadSessionID: &usedSession, CreatorID: owner.UserID})
	f.sessions.byID[41] = upload.Session{ID: 41, Status: upload.StatusCompleted, CreatorID: admin.UserID}
	f.sessions.byID[42] = upload.Session{ID: 42, Status: upload.StatusCompleted, CreatorID: admin.UserID, StoragePath: "/spool/42.part", TotalSize: 77, FileHash: "new", HashAlgorithm: upload.HashBLAKE3}
	f.repo.SeedFavorite(10, 5)
	f.repo.SeedFavorite(10, 5)
	f.repo.SeedFavorite(10, admin.UserID)
	f.repo.SeedFavorite(10, 6)

	expectCode(t, f.service.Reupload(ctx, admin, 999, download.ReuploadInput{UploadSessionID: 42}), download.ErrFileNotFound)
	expectCode(t, f.service.Reupload(ctx, admin, hidden.ID, download.ReuploadInput{UploadSessionID: 42}), download.ErrFileNotFound)
	expectCode(t, f.service.Reupload(ctx, admin, pending.ID, download.ReuploadInput{UploadSessionID: 42}), upload.ErrInvalidFileStatus)
	expectCode(t, f.service.Reupload(ctx, other, file.ID, download.ReuploadInput{UploadSessionID: 42}), download.ErrFileNotOwner)
	expectCode(t, f.service.Reupload(ctx, owner, file.ID, download.ReuploadInput{UploadSessionID: 42}), upload.ErrSessionNotOwner)
	expectCode(t, f.service.Reupload(ctx, admin, file.ID, download.ReuploadInput{UploadSessionID: 41}), upload.ErrSessionAlreadyUsed)

	if err := f.service.Reupload(ctx, admin, file.ID, download.ReuploadInput{UploadSessionID: 42, Reason: ptr("better rip")}); err != nil {
		t.Fatal(err)
	}
	updated, _ := f.repo.GetFile(ctx, file.ID)
	if updated.Status != download.FileOnServer || updated.CheckStatus != download.CheckPending || updated.StorageKey != nil || *updated.Path != "/spool/42.part" || *updated.UploadSessionID != 42 || updated.Size != 77 || updated.Hash != "new" {
		t.Fatalf("file after reupload %+v", updated)
	}
	if histories := f.repo.Histories(file.ID); len(histories) != 1 || histories[0].OperatorID != admin.UserID || *histories[0].Reason != "better rip" || histories[0].StorageKey != nil {
		t.Fatalf("history %+v", histories)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); !got.Updated.Equal(now) {
		t.Fatalf("reupload bumps the resource: %+v", got)
	}
	messages := f.events.Messages()
	if len(messages) != 2 || messages[0].ReceiverID != 5 || messages[1].ReceiverID != 6 {
		t.Fatalf("one message per favoriting user, never the operator: %+v", messages)
	}
	if meta := messages[0].Meta; meta["file_name"] != "a.7z" || meta["reason"] != "better rip" || meta["game_title_jp"] != "ゲーム" {
		t.Fatalf("meta %v", meta)
	}
	jobs := f.events.Jobs()
	if purge, ok := jobs[0].(download.PurgeObjects); len(jobs) != 1 || !ok || !slices.Equal(purge.Keys, []string{"games/10/1/a.7z"}) {
		t.Fatalf("old object purge %+v", jobs)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileReupload || recorded[0].UserID != admin.UserID {
		t.Fatalf("activity %+v", recorded)
	}
}

func TestHistoryAndReason(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	file := f.repo.SeedFile(download.File{ResourceID: resource.ID})
	f.repo.SeedHistory(download.History{FileID: file.ID, OperatorID: owner.UserID, Created: now.Add(-time.Hour)})
	f.repo.SeedHistory(download.History{FileID: file.ID, OperatorID: owner.UserID, Created: now})
	if _, err := f.service.History(ctx, 999); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("missing file: %v", err)
	}
	entries, err := f.service.History(ctx, file.ID)
	if err != nil || len(entries) != 2 || entries[0].ID != 2 {
		t.Fatalf("history newest first: %+v %v", entries, err)
	}
	expectCode(t, f.service.EditHistoryReason(ctx, owner, 999, ptr("x")), download.ErrFileNotFound)
	expectCode(t, f.service.EditHistoryReason(ctx, other, 1, ptr("x")), download.ErrFileNotOwner)
	if err := f.service.EditHistoryReason(ctx, owner, 1, ptr("")); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.repo.GetHistory(ctx, 1); got.Reason != nil {
		t.Fatalf("an empty reason is stored as null: %+v", got)
	}
	if err := f.service.EditHistoryReason(ctx, admin, 1, ptr("why")); err != nil {
		t.Fatal(err)
	}
}

func TestReleasesAndUserResources(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.repo.MarkRated(11)
	rated := f.repo.SeedResource(download.Resource{GameID: 11, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	safe := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now.Add(-time.Hour))})
	f.repo.SeedFile(download.File{ResourceID: safe.ID, Name: "a.7z"})
	f.repo.SeedFile(download.File{ResourceID: safe.ID, Name: "b.7z"})
	f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.MarkUploading(owner.UserID)

	strict, total, err := f.service.Releases(ctx, owner, download.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || strict[0].ID != safe.ID || strict[0].Game.TitleJP != "ゲーム" || strict[0].FilesCount != 2 {
		t.Fatalf("strict viewers skip rated games: %+v %d %v", strict, total, err)
	}
	permissive, total, _ := f.service.Releases(ctx, other, download.Page{Number: 1, Size: 10})
	if total != 2 || permissive[0].ID != rated.ID {
		t.Fatalf("permissive viewers see published resources, latest publication first: %+v", permissive)
	}
	mine, err := f.service.UserResources(ctx, owner, owner.UserID, download.Page{Number: 1, Size: 10})
	if err != nil || !mine.IsCurrentUser || !mine.HasOngoingSession || mine.Total != 2 {
		t.Fatalf("own resources %+v %v", mine, err)
	}
	theirs, _ := f.service.UserResources(ctx, other, owner.UserID, download.Page{Number: 1, Size: 10})
	if theirs.IsCurrentUser || theirs.HasOngoingSession || theirs.Total != 2 {
		t.Fatalf("someone else's resources %+v", theirs)
	}
	guest, _ := f.service.UserResources(ctx, actor.Guest(), 0, download.Page{Number: 1, Size: 10})
	if guest.IsCurrentUser {
		t.Fatal("guests are never the current user")
	}
}

func TestRemoveFileDropsEmptyResources(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	first := f.repo.SeedFile(download.File{ResourceID: resource.ID})
	second := f.repo.SeedFile(download.File{ResourceID: resource.ID})
	if _, found, err := f.service.RemoveFile(ctx, first.ID); err != nil || !found {
		t.Fatalf("remove first: %v %v", found, err)
	}
	if _, err := f.repo.GetResource(ctx, resource.ID); err != nil {
		t.Fatal("resources with files left are kept")
	}
	if _, found, err := f.service.RemoveFile(ctx, second.ID); err != nil || !found {
		t.Fatalf("remove second: %v %v", found, err)
	}
	if _, err := f.repo.GetResource(ctx, resource.ID); !errors.Is(err, download.ErrResourceNotFound) {
		t.Fatalf("empty resources are deleted: %v", err)
	}
	if _, found, err := f.service.RemoveFile(ctx, second.ID); err != nil || found {
		t.Fatalf("removing a missing file is a no-op: %v %v", found, err)
	}
}

func TestRequeueStoresQueuesApprovedFilesStillOnTheServer(t *testing.T) {
	f := newFixture()
	path := "/spool/a.sltf"
	approved := f.repo.SeedFile(download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckOK, Path: &path, Updated: now.Add(-time.Hour)})
	f.repo.SeedFile(download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckOK, Path: &path, Updated: now})
	f.repo.SeedFile(download.File{Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK, Path: &path, Updated: now.Add(-time.Hour)})
	f.repo.SeedFile(download.File{Type: download.FileTypeObjectStore, Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview, Path: &path, Updated: now.Add(-time.Hour)})
	if err := f.service.RequeueStores(context.Background(), now.Add(-15*time.Minute)); err != nil {
		t.Fatal(err)
	}
	jobs := f.events.Jobs()
	if len(jobs) != 1 || jobs[0] != download.Job(download.StoreFile{FileID: approved.ID}) {
		t.Fatalf("jobs %+v", jobs)
	}
	if !(download.StoreFile{}).UniqueByArgs() {
		t.Fatal("store jobs must be unique so the sweeper never doubles a transfer")
	}
}

func TestResourcesUnderMalwareReviewAreHiddenFromOthers(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, PublishedAt: ptr(now)})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "game.7z", Status: download.FileInObjectStore, CheckStatus: download.CheckOK, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "patch.exe", Status: download.FileOnServer, CheckStatus: download.CheckHarmfulPendingReview, CreatorID: owner.UserID})

	if seen, _ := f.service.GameResources(ctx, other, 10); len(seen) != 0 {
		t.Fatalf("a resource under review is hidden on the game page: %+v", seen)
	}
	if releases, total, _ := f.service.Releases(ctx, other, download.Page{Number: 1, Size: 10}); total != 0 || len(releases) != 0 {
		t.Fatalf("and in releases: %+v", releases)
	}
	if theirs, _ := f.service.UserResources(ctx, other, owner.UserID, download.Page{Number: 1, Size: 10}); theirs.Total != 0 {
		t.Fatalf("and on the uploader's page: %+v", theirs)
	}
	if mine, _ := f.service.GameResources(ctx, owner, 10); len(mine) != 1 || len(mine[0].Files) != 2 {
		t.Fatalf("its uploader still sees it with the held file: %+v", mine)
	}
}
