package download_test

import (
	"context"
	"encoding/json"
	"errors"
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
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
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

type withdrawal struct {
	UserID    int
	SessionID int
}

type quota struct {
	withdrawn []withdrawal
}

func (q *quota) Withdraw(_ context.Context, userID, sessionID int) error {
	q.withdrawn = append(q.withdrawn, withdrawal{userID, sessionID})
	return nil
}

type fixture struct {
	repo     *downloadtest.MemoryRepository
	sessions *sessions
	quota    *quota
	events   *downloadtest.Recorder
	store    *downloadtest.ObjectStore
	service  *download.Service
}

func newFixture() fixture {
	repo := downloadtest.NewMemoryRepository(func() time.Time { return now })
	f := fixture{
		repo:     repo,
		sessions: &sessions{byID: map[int]upload.Session{}},
		quota:    &quota{},
		events:   &downloadtest.Recorder{},
		store:    downloadtest.NewObjectStore(),
	}
	cards := gametest.NewCards(game.Card{ID: 10, TitleJP: "ゲーム", TitleZH: "游戏", TitleEN: "Game"}, game.Card{ID: 11})
	f.service = download.NewService(download.Deps{
		Repo:       repo,
		Games:      cards,
		Sessions:   f.sessions,
		Quota:      f.quota,
		Activities: f.events,
		Messages:   f.events,
		Tx:         &txtest.Immediate{},
		Queue:      f.events,
		Store:      f.store,
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
	stored := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
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
		t.Fatalf("others only see stored files: %+v %v", seen, err)
	}
	if seen[0].Files[0].LatestReupload() != nil {
		t.Fatal("a single history entry is the original upload, not a re-upload")
	}
	mine, _ := f.service.GameResources(ctx, owner, 10)
	if len(mine) != 2 {
		t.Fatalf("creators see their pending files: %+v", mine)
	}
	f.repo.SeedHistory(download.History{FileID: storedFile.ID, OperatorID: admin.UserID, Reason: ptr("fix"), Created: now})
	again, _ := f.service.GameResources(ctx, other, 10)
	if latest := again[0].Files[0].LatestReupload(); latest == nil || latest.OperatorID != admin.UserID || *latest.Reason != "fix" {
		t.Fatalf("latest re-upload: %+v", latest)
	}
}

func TestCreateFromCompletedSession(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.sessions.byID[5] = upload.Session{ID: 5, Status: upload.StatusCompleted, CreatorID: owner.UserID, FileName: "session.7z", StoragePath: "/spool/5.part", TotalSize: 2048, HashAlgorithm: upload.HashBLAKE3, FileHash: "b3", MimeType: ptr("application/octet-stream")}
	f.sessions.byID[6] = upload.Session{ID: 6, Status: upload.StatusUploading, CreatorID: owner.UserID}
	input := download.CreateInput{Platforms: []string{"and"}, Languages: []string{"jp"}, Simulator: ptr("KRKR"), UploadSessionID: 5}

	expectCode(t, f.service.Create(ctx, owner, 404, input), game.ErrNotFound)
	expectCode(t, f.service.Create(ctx, owner, 10, download.CreateInput{UploadSessionID: 99}), upload.ErrSessionNotFound)
	expectCode(t, f.service.Create(ctx, owner, 10, download.CreateInput{UploadSessionID: 6}), upload.ErrInvalidSessionStatus)
	expectCode(t, f.service.Create(ctx, other, 10, input), upload.ErrSessionNotOwner)

	if err := f.service.Create(ctx, owner, 10, input); err != nil {
		t.Fatal(err)
	}
	resource, _ := f.repo.GetResource(ctx, 1)
	files, _ := f.repo.ListFiles(ctx, resource.ID)
	if resource.Simulator == nil || *resource.Simulator != "KRKR" || *resource.UploadSessionID != 5 || len(files) != 1 {
		t.Fatalf("resource %+v files %+v", resource, files)
	}
	file := files[0]
	if file.Name != "session.7z" || *file.Path != "/spool/5.part" || file.Size != 2048 || file.Status != download.FileOnServer || file.CheckStatus != download.CheckPending || file.Hash != "b3" {
		t.Fatalf("file %+v", file)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileUploadToServer || *recorded[0].FileStatus != download.FileOnServer || *recorded[0].FileCheckStatus != 0 || *recorded[0].FileSize != 2048 {
		t.Fatalf("activity %+v", recorded)
	}
	expectCode(t, f.service.Create(ctx, owner, 10, input), download.ErrSessionAlreadyUsed)
	expectCode(t, f.service.Create(ctx, owner, 11, input), download.ErrSessionAlreadyUsed)
}

func TestEditRules(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	resource := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Note: ptr("old"), Simulator: ptr("ONS")})
	f.repo.SeedFile(download.File{ResourceID: resource.ID, Name: "a.7z"})
	removed := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID, Status: download.ResourceRemoved})
	changes := download.ResourceChanges{Platforms: []string{"win"}, Languages: []string{"zh"}, FileName: ptr("renamed.7z")}

	expectCode(t, f.service.Edit(ctx, owner, 999, changes), download.ErrResourceNotFound)
	expectCode(t, f.service.Edit(ctx, owner, removed.ID, changes), download.ErrResourceNotFound)
	expectCode(t, f.service.Edit(ctx, other, resource.ID, changes), download.ErrResourceNotOwner)
	if err := f.service.Edit(ctx, admin, resource.ID, changes); err != nil {
		t.Fatalf("admins may edit: %v", err)
	}
	got, _ := f.repo.GetResource(ctx, resource.ID)
	files, _ := f.repo.ListFiles(ctx, resource.ID)
	if got.Simulator != nil || *got.Note != "old" || !slices.Equal(got.Platforms, []string{"win"}) || files[0].Name != "renamed.7z" {
		t.Fatalf("edited %+v files %+v", got, files)
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
	if !slices.Equal(f.quota.withdrawn, []withdrawal{{UserID: owner.UserID, SessionID: oldSession}}) {
		t.Fatalf("the original creator is refunded for the replaced session: %+v", f.quota.withdrawn)
	}
	if got, _ := f.repo.GetResource(ctx, resource.ID); !got.Updated.Equal(now) {
		t.Fatalf("reupload bumps the resource: %+v", got)
	}
	messages := f.events.Messages()
	if len(messages) != 2 || messages[0].ReceiverID != 5 || messages[1].ReceiverID != 6 {
		t.Fatalf("one message per favoriting user, never the operator: %+v", messages)
	}
	var meta map[string]any
	if err := json.Unmarshal(messages[0].Meta, &meta); err != nil || meta["file_name"] != "a.7z" || meta["reason"] != "better rip" || meta["game_title_jp"] != "ゲーム" {
		t.Fatalf("meta %v %v", meta, err)
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
	safe := f.repo.SeedResource(download.Resource{GameID: 10, CreatorID: owner.UserID})
	f.repo.SeedFile(download.File{ResourceID: safe.ID, Name: "a.7z"})
	f.repo.SeedFile(download.File{ResourceID: safe.ID, Name: "b.7z"})
	rated := f.repo.SeedResource(download.Resource{GameID: 11, CreatorID: owner.UserID})
	f.repo.MarkUploading(owner.UserID)

	strict, total, err := f.service.Releases(ctx, owner, download.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || strict[0].ID != safe.ID || strict[0].Game.TitleJP != "ゲーム" || strict[0].FilesCount != 2 {
		t.Fatalf("strict viewers skip rated games: %+v %d %v", strict, total, err)
	}
	permissive, total, _ := f.service.Releases(ctx, other, download.Page{Number: 1, Size: 10})
	if total != 2 || permissive[0].ID != rated.ID {
		t.Fatalf("permissive viewers see everything newest first: %+v", permissive)
	}
	mine, err := f.service.UserResources(ctx, owner, owner.UserID, download.Page{Number: 1, Size: 10})
	if err != nil || !mine.IsCurrentUser || !mine.HasOngoingSession || mine.Total != 1 {
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
