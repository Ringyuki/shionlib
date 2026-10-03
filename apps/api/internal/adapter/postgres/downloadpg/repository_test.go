package downloadpg_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/downloadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var _ download.Repository = (*downloadpg.Repository)(nil)

type fixture struct {
	db   *pgtest.DB
	repo *downloadpg.Repository
}

func newFixture(t *testing.T) fixture {
	db := pgtest.New(t)
	return fixture{db: db, repo: downloadpg.NewRepository(db.Ent)}
}

func ptr[T any](v T) *T {
	return &v
}

func (f fixture) resource(t *testing.T, gameID, creator int, mutate ...func(*ent.GameDownloadResourceCreate)) *ent.GameDownloadResource {
	t.Helper()
	create := f.db.Ent.GameDownloadResource.Create().
		SetGameID(gameID).
		SetCreatorID(creator).
		SetPlatform(pgvalue.Strings{"win"}).
		SetLanguage(pgvalue.Strings{"jp"})
	for _, fn := range mutate {
		fn(create)
	}
	row, err := create.Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func (f fixture) file(t *testing.T, resourceID, creator int, name string, mutate ...func(*ent.GameDownloadResourceFileCreate)) *ent.GameDownloadResourceFile {
	t.Helper()
	create := f.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resourceID).
		SetType(download.FileTypeObjectStore).
		SetFileName(name).
		SetFileSize(42).
		SetFileHash("hash-" + name).
		SetFileStatus(download.FileInObjectStore).
		SetCreatorID(creator)
	for _, fn := range mutate {
		fn(create)
	}
	row, err := create.Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row
}

func (f fixture) session(t *testing.T, creator int, status gameuploadsession.Status) int {
	t.Helper()
	row, err := f.db.Ent.GameUploadSession.Create().
		SetFileName("upload.7z").
		SetTotalSize(10).
		SetChunkSize(10).
		SetTotalChunks(1).
		SetUploadedChunks(pgvalue.Ints{}).
		SetFileSha256("hash").
		SetStatus(status).
		SetStoragePath(fmt.Sprintf("/spool/%d-%d.sltf", creator, time.Now().UnixNano())).
		SetExpiresAt(time.Now().UTC().Add(time.Hour)).
		SetCreatorID(creator).
		Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row.ID
}

func (f fixture) history(t *testing.T, fileID, operator int, created time.Time, reason *string) int {
	t.Helper()
	row, err := f.db.Ent.GameDownloadResourceFileHistory.Create().
		SetFileID(fileID).
		SetFileSize(1).
		SetHashAlgorithm("blake3").
		SetFileHash("h").
		SetNillableReason(reason).
		SetOperatorID(operator).
		SetCreated(created).
		Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row.ID
}

func TestResourceLifecycle(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	session := f.session(t, creator, gameuploadsession.StatusCOMPLETED)

	created, err := f.repo.CreateResource(ctx, download.NewResource{
		GameID:          gameID,
		Platforms:       []string{"and", "win"},
		Languages:       []string{"zh"},
		Simulator:       ptr("KRKR"),
		Note:            ptr("note"),
		UploadSessionID: &session,
		CreatorID:       creator,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != download.ResourceActive || created.Simulator == nil || *created.Simulator != "KRKR" || !slices.Equal(created.Platforms, []string{"and", "win"}) || created.UploadSessionID == nil || *created.UploadSessionID != session {
		t.Fatalf("unexpected resource %+v", created)
	}
	if _, err := f.repo.CreateResource(ctx, download.NewResource{GameID: 987654, CreatorID: creator}); !errors.Is(err, game.ErrNotFound) {
		t.Fatalf("missing game: %v", err)
	}
	if used, err := f.repo.ResourceUsesSession(ctx, gameID, session); err != nil || !used {
		t.Fatalf("session usage: %v %v", used, err)
	}
	if used, _ := f.repo.ResourceUsesSession(ctx, f.db.Game(t), session); used {
		t.Fatal("session usage is scoped to the game")
	}

	first := f.file(t, created.ID, creator, "a.7z")
	second := f.file(t, created.ID, creator, "b.7z")
	pinned := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := f.db.Ent.GameDownloadResource.UpdateOneID(created.ID).SetUpdated(pinned).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	err = postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := f.repo.LockResource(ctx, created.ID); err != nil {
			return err
		}
		return f.repo.UpdateResource(ctx, created.ID, download.ResourceChanges{Platforms: []string{"win"}, Languages: []string{"en", "jp"}, FileName: ptr("renamed.7z")})
	})
	if err != nil {
		t.Fatal(err)
	}
	updated, err := f.repo.GetResource(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !updated.Updated.Equal(pinned) || updated.Simulator != nil || updated.Note == nil || *updated.Note != "note" || !slices.Equal(updated.Languages, []string{"en", "jp"}) {
		t.Fatalf("edit must preserve updated and note, clear simulator: %+v", updated)
	}
	files, err := f.repo.ListFiles(ctx, created.ID)
	if err != nil || len(files) != 2 || files[0].ID != first.ID || files[1].ID != second.ID || files[0].Name != "renamed.7z" || files[1].Name != "renamed.7z" {
		t.Fatalf("files must be renamed: %+v %v", files, err)
	}
	if err := f.repo.UpdateResource(ctx, created.ID, download.ResourceChanges{Platforms: []string{"ios"}, Languages: []string{"jp"}, Simulator: ptr("ONS"), Note: ptr("changed")}); err != nil {
		t.Fatal(err)
	}
	updated, _ = f.repo.GetResource(ctx, created.ID)
	if updated.Simulator == nil || *updated.Simulator != "ONS" || *updated.Note != "changed" {
		t.Fatalf("simulator and note update: %+v", updated)
	}

	removedAt := time.Date(2026, 5, 6, 7, 8, 9, 0, time.UTC)
	if err := f.repo.SetResourceStatus(ctx, created.ID, download.ResourceRemoved, removedAt); err != nil {
		t.Fatal(err)
	}
	updated, _ = f.repo.GetResource(ctx, created.ID)
	if updated.Status != download.ResourceRemoved || !updated.Updated.Equal(removedAt) {
		t.Fatalf("status change: %+v", updated)
	}
	touchedAt := removedAt.Add(time.Hour)
	if err := f.repo.TouchResource(ctx, created.ID, touchedAt); err != nil {
		t.Fatal(err)
	}
	if updated, _ = f.repo.GetResource(ctx, created.ID); !updated.Updated.Equal(touchedAt) {
		t.Fatalf("touch: %+v", updated)
	}
	if count, err := f.repo.CountFiles(ctx, created.ID); err != nil || count != 2 {
		t.Fatalf("count files: %d %v", count, err)
	}
	if err := f.repo.DeleteResource(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.GetFile(ctx, first.ID); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("files cascade with their resource: %v", err)
	}

	for name, call := range map[string]func() error{
		"get":    func() error { _, err := f.repo.GetResource(ctx, 987654); return err },
		"lock":   func() error { _, err := f.repo.LockResource(ctx, 987654); return err },
		"update": func() error { return f.repo.UpdateResource(ctx, 987654, download.ResourceChanges{}) },
		"status": func() error { return f.repo.SetResourceStatus(ctx, 987654, 2, removedAt) },
		"touch":  func() error { return f.repo.TouchResource(ctx, 987654, removedAt) },
		"delete": func() error { return f.repo.DeleteResource(ctx, 987654) },
		"count":  func() error { return f.repo.CountDownload(ctx, 987654, gameID) },
	} {
		if err := call(); !errors.Is(err, download.ErrResourceNotFound) {
			t.Fatalf("%s on a missing resource: %v", name, err)
		}
	}
}

func TestCreateFileTranslatesConstraints(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	resource := f.resource(t, gameID, creator)
	session := f.session(t, creator, gameuploadsession.StatusCOMPLETED)

	file, err := f.repo.CreateFile(ctx, download.NewFile{
		ResourceID:      resource.ID,
		Type:            download.FileTypeObjectStore,
		Name:            "game.7z",
		Path:            ptr("/spool/game.sltf"),
		Size:            99,
		ContentType:     ptr("application/octet-stream"),
		HashAlgorithm:   upload.HashBLAKE3,
		Hash:            "digest",
		UploadSessionID: &session,
		Status:          download.FileOnServer,
		CreatorID:       creator,
	})
	if err != nil {
		t.Fatal(err)
	}
	if file.GameID != gameID || file.ResourceStatus != download.ResourceActive || file.CheckStatus != download.CheckPending || file.Status != download.FileOnServer || file.HashAlgorithm != upload.HashBLAKE3 || file.Path == nil || *file.Path != "/spool/game.sltf" {
		t.Fatalf("unexpected file %+v", file)
	}
	found, ok, err := f.repo.FindFileBySession(ctx, session)
	if err != nil || !ok || found.ID != file.ID {
		t.Fatalf("find by session: %+v %v %v", found, ok, err)
	}
	if _, ok, _ := f.repo.FindFileBySession(ctx, 987654); ok {
		t.Fatal("unknown session has no file")
	}

	cases := []struct {
		name string
		in   download.NewFile
		want error
	}{
		{name: "missing resource", in: download.NewFile{ResourceID: 987654, Name: "x", Hash: "h", HashAlgorithm: upload.HashBLAKE3, CreatorID: creator}, want: download.ErrResourceNotFound},
		{name: "reused session", in: download.NewFile{ResourceID: resource.ID, Name: "x", Hash: "h", HashAlgorithm: upload.HashBLAKE3, UploadSessionID: &session, CreatorID: creator}, want: upload.ErrSessionAlreadyUsed},
		{name: "reused path", in: download.NewFile{ResourceID: resource.ID, Name: "x", Hash: "h", HashAlgorithm: upload.HashBLAKE3, Path: ptr("/spool/game.sltf"), CreatorID: creator}, want: upload.ErrSessionAlreadyUsed},
		{name: "missing session", in: download.NewFile{ResourceID: resource.ID, Name: "x", Hash: "h", HashAlgorithm: upload.HashBLAKE3, UploadSessionID: ptr(987654), CreatorID: creator}, want: upload.ErrSessionNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := f.repo.CreateFile(ctx, tc.in); !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
}

func TestCountDownloadPreservesResourceUpdated(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	resource := f.resource(t, gameID, creator)
	pinned := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := f.db.Ent.GameDownloadResource.UpdateOneID(resource.ID).SetUpdated(pinned).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.db.Ent.Game.UpdateOneID(gameID).SetUpdated(pinned).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	err := postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		return f.repo.CountDownload(ctx, resource.ID, gameID)
	})
	if err != nil {
		t.Fatal(err)
	}
	gotResource, _ := f.repo.GetResource(ctx, resource.ID)
	if gotResource.Downloads != 1 || !gotResource.Updated.Equal(pinned) {
		t.Fatalf("resource counter must not bump updated: %+v", gotResource)
	}
	gotGame, err := f.db.Ent.Game.Get(ctx, gameID)
	if err != nil {
		t.Fatal(err)
	}
	if gotGame.Downloads != 1 || !gotGame.Updated.After(pinned) {
		t.Fatalf("game counter bumps updated: downloads %d updated %v", gotGame.Downloads, gotGame.Updated)
	}
}

func TestListGameResources(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	operator := f.db.User(t)
	gameID := f.db.Game(t)
	first := f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) { c.SetNote("first") })
	second := f.resource(t, gameID, creator)
	f.resource(t, gameID, creator, func(c *ent.GameDownloadResourceCreate) { c.SetStatus(download.ResourceRemoved) })
	f.resource(t, f.db.Game(t), creator)

	onceUploaded := f.file(t, first.ID, creator, "once.7z")
	reuploaded := f.file(t, first.ID, creator, "twice.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileStatus(download.FileOnServer).SetFilePath("/spool/x.sltf")
	})
	f.file(t, second.ID, creator, "other.7z")

	base := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	f.history(t, onceUploaded.ID, creator, base, nil)
	f.history(t, reuploaded.ID, creator, base, nil)
	middle := f.history(t, reuploaded.ID, operator, base.Add(time.Hour), ptr("fix"))
	newest := f.history(t, reuploaded.ID, operator, base.Add(2*time.Hour), ptr("again"))

	scanCase, err := f.db.Ent.MalwareScanCase.Create().
		SetFileID(reuploaded.ID).
		SetUploaderID(creator).
		SetReviewDeadline(base).
		SetDetector("clamscan").
		SetDetectedViruses(pgvalue.Strings{"Eicar"}).
		SetFileName("twice.7z").
		SetFileSize(1).
		SetFileHash("h").
		Save(ctx)
	if err != nil {
		t.Fatal(err)
	}

	resources, err := f.repo.ListGameResources(ctx, gameID)
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 2 || resources[0].ID != first.ID || resources[1].ID != second.ID {
		t.Fatalf("only active resources of the game, ordered by id: %+v", resources)
	}
	got := resources[0]
	if got.Creator.ID != creator || got.Creator.Name == "" || got.Note == nil || *got.Note != "first" || len(got.Files) != 2 {
		t.Fatalf("unexpected resource %+v", got)
	}
	once, twice := got.Files[0], got.Files[1]
	if once.ID != onceUploaded.ID || len(once.RecentHistory) != 1 || once.LatestReupload() != nil || len(once.MalwareCases) != 0 || once.GameID != gameID || once.Creator.ID != creator {
		t.Fatalf("file with a single upload: %+v", once)
	}
	if twice.Status != download.FileOnServer || len(twice.RecentHistory) != 2 || twice.RecentHistory[0].ID != newest || twice.RecentHistory[1].ID != middle {
		t.Fatalf("recent history is the two newest entries: %+v", twice.RecentHistory)
	}
	latest := twice.LatestReupload()
	if latest == nil || latest.ID != newest || latest.Reason == nil || *latest.Reason != "again" || latest.OperatorID != operator {
		t.Fatalf("latest reupload: %+v", latest)
	}
	if len(twice.MalwareCases) != 1 || twice.MalwareCases[0].ID != scanCase.ID || !slices.Equal(twice.MalwareCases[0].Viruses, []string{"Eicar"}) {
		t.Fatalf("malware cases: %+v", twice.MalwareCases)
	}
	if empty, err := f.repo.ListGameResources(ctx, f.db.Game(t)); err != nil || len(empty) != 0 {
		t.Fatalf("game without resources: %+v %v", empty, err)
	}
}

func TestListReleasesAndUserResources(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	alice, bob := f.db.User(t), f.db.User(t)
	safeGame := f.db.Game(t)
	nsfwGame := f.db.Game(t, func(c *ent.GameCreate) { c.SetNsfw(true) })
	coverGame := f.db.Game(t)
	if _, err := f.db.Ent.GameCover.Create().SetGameID(coverGame).SetLanguage("jp").SetURL("c.webp").SetType("pkgfront").SetSexual(1).SetViolence(0).Save(ctx); err != nil {
		t.Fatal(err)
	}
	created := func(at time.Time) func(*ent.GameDownloadResourceCreate) {
		return func(c *ent.GameDownloadResourceCreate) { c.SetCreated(at) }
	}
	base := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	oldest := f.resource(t, safeGame, alice, created(base))
	newest := f.resource(t, safeGame, bob, created(base.Add(3*time.Hour)))
	nsfw := f.resource(t, nsfwGame, alice, created(base.Add(time.Hour)))
	covered := f.resource(t, coverGame, alice, created(base.Add(2*time.Hour)))
	f.resource(t, safeGame, alice, created(base.Add(4*time.Hour)), func(c *ent.GameDownloadResourceCreate) { c.SetStatus(download.ResourceRemoved) })
	f.file(t, oldest.ID, alice, "b-second.7z")
	f.file(t, oldest.ID, alice, "a-first.7z", func(c *ent.GameDownloadResourceFileCreate) { c.SetFileStatus(download.FileOnServer) })

	all, total, err := f.repo.ListReleases(ctx, false, download.Page{Number: 1, Size: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 4 || len(all) != 4 || all[0].ID != newest.ID || all[1].ID != covered.ID || all[2].ID != nsfw.ID || all[3].ID != oldest.ID {
		t.Fatalf("releases newest first: %d %+v", total, all)
	}
	if last := all[3]; last.GameID != safeGame || last.FilesCount != 2 || !slices.Equal(last.FileNames, []string{"b-second.7z", "a-first.7z"}) || last.Creator.ID != alice {
		t.Fatalf("release shape: %+v", last)
	}
	safe, total, err := f.repo.ListReleases(ctx, true, download.Page{Number: 1, Size: 1})
	if err != nil || total != 2 || len(safe) != 1 || safe[0].ID != newest.ID {
		t.Fatalf("strict viewers skip rated games: %d %+v %v", total, safe, err)
	}
	next, _, _ := f.repo.ListReleases(ctx, true, download.Page{Number: 2, Size: 1})
	if len(next) != 1 || next[0].ID != oldest.ID {
		t.Fatalf("second page: %+v", next)
	}

	mine, total, err := f.repo.ListUserResources(ctx, alice, false, download.Page{Number: 1, Size: 10})
	if err != nil || total != 3 || len(mine) != 3 || mine[0].ID != covered.ID || mine[2].ID != oldest.ID {
		t.Fatalf("user resources: %d %+v %v", total, mine, err)
	}
	strict, total, err := f.repo.ListUserResources(ctx, alice, true, download.Page{Number: 1, Size: 10})
	if err != nil || total != 1 || len(strict) != 1 || strict[0].ID != oldest.ID || strict[0].FilesCount != 2 {
		t.Fatalf("strict user resources: %d %+v %v", total, strict, err)
	}
}

func TestFileOperations(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	gameID := f.db.Game(t)
	resource := f.resource(t, gameID, creator)
	stored := f.file(t, resource.ID, creator, "stored.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFilePath("/spool/stored.sltf").SetS3FileKey("games/1/1/stored.7z").SetIsVirusFalsePositive(true).SetFileCheckStatus(1)
	})
	f.file(t, resource.ID, creator, "clean.7z")
	rejected := f.file(t, resource.ID, creator, "broken.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileStatus(download.FileOnServer).SetFileCheckStatus(int(download.CheckEncrypted)).SetFilePath("/spool/broken.sltf")
	})
	f.file(t, resource.ID, creator, "review.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileStatus(download.FileOnServer).SetFileCheckStatus(int(download.CheckHarmfulPendingReview)).SetFilePath("/spool/review.sltf")
	})
	f.file(t, resource.ID, creator, "link", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetType(download.FileTypeDirectLink).SetFilePath("/spool/link.sltf")
	})
	withCopies, err := f.repo.ListStoredWithLocalCopy(ctx, 10)
	if err != nil || len(withCopies) != 1 || withCopies[0].ID != stored.ID {
		t.Fatalf("stored files with local copies: %+v %v", withCopies, err)
	}
	rejectedFiles, err := f.repo.ListRejected(ctx, 10)
	if err != nil || len(rejectedFiles) != 1 || rejectedFiles[0].ID != rejected.ID || rejectedFiles[0].GameID != gameID {
		t.Fatalf("rejected files: %+v %v", rejectedFiles, err)
	}
	if err := f.repo.ClearFilePath(ctx, stored.ID); err != nil {
		t.Fatal(err)
	}
	if withCopies, _ = f.repo.ListStoredWithLocalCopy(ctx, 10); len(withCopies) != 0 {
		t.Fatalf("cleared path: %+v", withCopies)
	}

	session := f.session(t, creator, gameuploadsession.StatusCOMPLETED)
	err = postgres.NewTransactor(f.db.Ent).WithinTransaction(ctx, func(ctx context.Context) error {
		locked, err := f.repo.LockFile(ctx, stored.ID)
		if err != nil {
			return err
		}
		if locked.GameID != gameID || locked.ResourceStatus != download.ResourceActive {
			return fmt.Errorf("locked file lacks resource data: %+v", locked)
		}
		return f.repo.ReplaceFileContent(ctx, stored.ID, download.FileContent{Path: "/spool/new.sltf", Size: 7, Hash: "new", HashAlgorithm: upload.HashBLAKE3, UploadSessionID: session})
	})
	if err != nil {
		t.Fatal(err)
	}
	replaced, err := f.repo.GetFile(ctx, stored.ID)
	if err != nil {
		t.Fatal(err)
	}
	if replaced.Status != download.FileOnServer || replaced.CheckStatus != download.CheckPending || replaced.FalsePositive || replaced.StorageKey != nil || replaced.Path == nil || *replaced.Path != "/spool/new.sltf" || replaced.Size != 7 || replaced.Hash != "new" || replaced.UploadSessionID == nil || *replaced.UploadSessionID != session || replaced.ContentType != nil {
		t.Fatalf("replaced content: %+v", replaced)
	}
	if err := f.repo.MarkFileStored(ctx, stored.ID, "games/9/9/new.7z"); err != nil {
		t.Fatal(err)
	}
	if replaced, _ = f.repo.GetFile(ctx, stored.ID); replaced.Status != download.FileInObjectStore || replaced.StorageKey == nil || *replaced.StorageKey != "games/9/9/new.7z" {
		t.Fatalf("stored: %+v", replaced)
	}
	if err := f.repo.DeleteFile(ctx, rejected.ID); err != nil {
		t.Fatal(err)
	}
	for name, call := range map[string]func() error{
		"get":    func() error { _, err := f.repo.GetFile(ctx, rejected.ID); return err },
		"lock":   func() error { _, err := f.repo.LockFile(ctx, rejected.ID); return err },
		"delete": func() error { return f.repo.DeleteFile(ctx, rejected.ID) },
		"replace": func() error {
			return f.repo.ReplaceFileContent(ctx, rejected.ID, download.FileContent{Path: "/x", HashAlgorithm: upload.HashBLAKE3})
		},
		"stored": func() error { return f.repo.MarkFileStored(ctx, rejected.ID, "k") },
		"clear":  func() error { return f.repo.ClearFilePath(ctx, rejected.ID) },
	} {
		if err := call(); !errors.Is(err, download.ErrFileNotFound) {
			t.Fatalf("%s on a missing file: %v", name, err)
		}
	}
	if limited, _ := f.repo.ListFiles(ctx, resource.ID); len(limited) != 4 {
		t.Fatalf("remaining files: %+v", limited)
	}
}

func TestHistory(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator, operator := f.db.User(t), f.db.User(t)
	resource := f.resource(t, f.db.Game(t), creator)
	file := f.file(t, resource.ID, creator, "game.7z")

	if _, found, err := f.repo.LatestHistory(ctx, file.ID); err != nil || found {
		t.Fatalf("no history yet: %v %v", found, err)
	}
	if err := f.repo.CreateHistory(ctx, download.NewHistory{FileID: file.ID, Size: 5, HashAlgorithm: upload.HashBLAKE3, Hash: "first", OperatorID: creator}); err != nil {
		t.Fatal(err)
	}
	if err := f.repo.CreateHistory(ctx, download.NewHistory{FileID: file.ID, Size: 6, HashAlgorithm: upload.HashSHA256, Hash: "second", Reason: ptr("why"), OperatorID: operator}); err != nil {
		t.Fatal(err)
	}
	if err := f.repo.CreateHistory(ctx, download.NewHistory{FileID: 987654, HashAlgorithm: upload.HashBLAKE3, OperatorID: creator}); !errors.Is(err, download.ErrFileNotFound) {
		t.Fatalf("history of a missing file: %v", err)
	}
	latest, found, err := f.repo.LatestHistory(ctx, file.ID)
	if err != nil || !found || latest.Hash != "second" || latest.HashAlgorithm != upload.HashSHA256 || latest.OperatorID != operator {
		t.Fatalf("latest: %+v %v %v", latest, found, err)
	}
	if err := f.repo.SetHistoryStorageKey(ctx, latest.ID, "games/1/2/game.7z"); err != nil {
		t.Fatal(err)
	}
	entries, err := f.repo.ListHistory(ctx, file.ID)
	if err != nil || len(entries) != 2 || entries[0].ID != latest.ID || entries[0].Operator.ID != operator || entries[0].StorageKey == nil || *entries[0].StorageKey != "games/1/2/game.7z" || entries[1].Hash != "first" {
		t.Fatalf("history newest first: %+v %v", entries, err)
	}
	if err := f.repo.SetHistoryReason(ctx, latest.ID, nil); err != nil {
		t.Fatal(err)
	}
	got, err := f.repo.GetHistory(ctx, latest.ID)
	if err != nil || got.Reason != nil {
		t.Fatalf("cleared reason: %+v %v", got, err)
	}
	if err := f.repo.SetHistoryReason(ctx, latest.ID, ptr("again")); err != nil {
		t.Fatal(err)
	}
	if got, _ = f.repo.GetHistory(ctx, latest.ID); got.Reason == nil || *got.Reason != "again" {
		t.Fatalf("reason: %+v", got)
	}
	for name, call := range map[string]func() error{
		"get":    func() error { _, err := f.repo.GetHistory(ctx, 987654); return err },
		"reason": func() error { return f.repo.SetHistoryReason(ctx, 987654, nil) },
		"key":    func() error { return f.repo.SetHistoryStorageKey(ctx, 987654, "k") },
	} {
		if err := call(); !errors.Is(err, download.ErrFileNotFound) {
			t.Fatalf("%s on missing history: %v", name, err)
		}
	}
}

func TestUsersAndSessions(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	operator, fan, collector, stranger := f.db.User(t), f.db.User(t), f.db.User(t), f.db.User(t)
	gameID := f.db.Game(t)
	favorite := func(user int, name string) {
		list, err := f.db.Ent.Favorite.Create().SetUserID(user).SetName(name).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if err := f.db.Ent.FavoriteItem.Create().SetFavoriteID(list.ID).SetGameID(gameID).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	favorite(fan, "one")
	favorite(collector, "a")
	favorite(collector, "b")
	favorite(operator, "mine")
	receivers, err := f.repo.FavoriteReceivers(ctx, gameID, operator)
	if err != nil || !slices.Equal(receivers, []int{fan, collector}) {
		t.Fatalf("favorite receivers are distinct and exclude the operator: %v %v", receivers, err)
	}

	if err := f.db.Ent.User.UpdateOneID(operator).SetUploadInjectedFileTimes(2).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.repo.ResetMalwareStrikes(ctx, operator); err != nil {
		t.Fatal(err)
	}
	if user, _ := f.db.Ent.User.Get(ctx, operator); user.UploadInjectedFileTimes != 0 {
		t.Fatalf("strikes not reset: %d", user.UploadInjectedFileTimes)
	}

	f.session(t, fan, gameuploadsession.StatusUPLOADING)
	f.session(t, collector, gameuploadsession.StatusCOMPLETED)
	if has, err := f.repo.HasUploadingSession(ctx, fan); err != nil || !has {
		t.Fatalf("uploading session: %v %v", has, err)
	}
	if has, _ := f.repo.HasUploadingSession(ctx, collector); has {
		t.Fatal("completed sessions are not ongoing")
	}
	if has, _ := f.repo.HasUploadingSession(ctx, stranger); has {
		t.Fatal("user without sessions")
	}
}

func TestListAwaitingStore(t *testing.T) {
	ctx := context.Background()
	f := newFixture(t)
	creator := f.db.User(t)
	resource := f.resource(t, f.db.Game(t), creator)
	approved := f.file(t, resource.ID, creator, "approved.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileStatus(download.FileOnServer).SetFileCheckStatus(int(download.CheckOK)).SetFilePath("/spool/approved.sltf")
	})
	f.file(t, resource.ID, creator, "unscanned.7z", func(c *ent.GameDownloadResourceFileCreate) {
		c.SetFileStatus(download.FileOnServer).SetFilePath("/spool/unscanned.sltf")
	})
	awaiting, err := f.repo.ListAwaitingStore(ctx, time.Now().Add(time.Hour), 10)
	if err != nil || len(awaiting) != 1 || awaiting[0] != approved.ID {
		t.Fatalf("approved files awaiting storage: %v %v", awaiting, err)
	}
	if recent, err := f.repo.ListAwaitingStore(ctx, time.Now().Add(-time.Hour), 10); err != nil || len(recent) != 0 {
		t.Fatalf("recently approved files are left to their own job: %v %v", recent, err)
	}

}
