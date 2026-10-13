package bootstrap_test

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/unicode/norm"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/clamd"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/imaging"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/compositionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/downloadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourceevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gameuploadsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/inspectionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/scanpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/translatorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/zipnames"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection/inspectiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

type shelf struct {
	dir     string
	objects bucket
}

func (s shelf) Fetch(ctx context.Context, key, path string) error {
	return s.objects.Fetch(ctx, key, path)
}

func (s shelf) Download(ctx context.Context, key, path string, observe func(done int64)) error {
	if err := s.objects.Fetch(ctx, key, path); err != nil {
		return err
	}
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	observe(info.Size())
	return nil
}

func (s shelf) Put(_ context.Context, object download.Object) error {
	content, err := os.ReadFile(object.LocalPath)
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(object.Key))
	path := filepath.Join(s.dir, hex.EncodeToString(digest[:]))
	if err := os.MkdirAll(s.dir, 0o750); err != nil {
		return err
	}
	if err := os.WriteFile(path, content, 0o600); err != nil {
		return err
	}
	s.objects[object.Key] = path
	return nil
}

func (s shelf) Delete(_ context.Context, key string) error {
	delete(s.objects, key)
	return nil
}

func (s shelf) DeleteVersionsBefore(context.Context, string, time.Time) error {
	return nil
}

func (s shelf) List(context.Context) (download.Listing, error) {
	return download.Listing{}, nil
}

type composeLine struct {
	db       *pgtest.DB
	binary   string
	root     string
	shelf    shelf
	drafts   *composition.Service
	reads    *composition.ReadService
	runs     *composition.RunService
	backfill *scan.BackfillService
	notices  *compositiontest.Recorder
	files    *downloadtest.Recorder
	now      time.Time
}

func newComposeLine(t *testing.T, binary string) composeLine {
	t.Helper()
	db := pgtest.New(t)
	now := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	clock := func() time.Time { return now }
	tx := postgres.NewTransactor(db.Ent)
	settings := settingtest.Source{}
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	spool := localfs.NewSpool(root, ".part")
	quota := upload.NewQuotaService(uploadpg.NewQuotaRepository(db.Ent), settings, clock)
	uploads := upload.NewService(uploadpg.NewRepository(db.Ent), quota, spool, uploadtest.NewMemoryHolds(), tx, settings, clock)
	cards := game.NewCardService(gamepg.NewCardStore(db.Ent))
	downloadRepo := downloadpg.NewRepository(db.Ent)
	inspectionRepo := inspectionpg.NewRepository(db.Ent)
	names := download.NewNameService(downloadRepo, cards, inspection.NewMediumService(inspectionRepo), tx)
	files := &downloadtest.Recorder{}
	objects := shelf{dir: filepath.Join(t.TempDir(), "bucket"), objects: bucket{}}
	downloads := download.NewService(download.Deps{
		Repo: downloadRepo, Games: cards, Comments: downloadtest.Discussions{}, Translators: translator.NewService(translatorpg.NewRepository(db.Ent)), Names: names, Sessions: uploads,
		Activities: files, Messages: files, Tx: tx, Queue: files, Store: objects, Local: spool, Settings: settings, Now: clock,
	})
	transfers := download.NewTransferService(downloadRepo, objects, spool, files, files, names, tx, clock)
	archives := sevenzip.New(binary)
	scanner := clamd.New(clamd.Options{Address: serveClamd(t), Timeout: 5 * time.Second, LogDir: t.TempDir()})
	workspace := localfs.NewWorkspace(filepath.Join(root, ".work"))
	scans := scan.NewService(scan.Deps{
		Repo:        scanpg.NewRepository(db.Ent),
		Archives:    archives,
		Scanner:     scanner,
		Workspace:   workspace,
		Contents:    scan.NewContentService(scan.ContentDeps{Archives: archives, Names: zipnames.NewReader(), Discs: discimage.NewReader(), Workspace: workspace, Spool: uploads, Scanner: scanner}),
		Inspections: inspection.NewRecordService(inspectionRepo, inspectiontest.NewPreviewStore(), imaging.NewTranscoder(), tx, clock),
		Files:       downloads,
		Activities:  files,
		Messages:    files,
		Banner:      &scantest.Banner{},
		Queue:       files,
		Tx:          tx,
		Settings:    settings,
		Options:     scan.Options{Enabled: true},
		Now:         clock,
	})
	notices := &compositiontest.Recorder{}
	examiner := scan.NewLocalService(scans)
	composed := download.NewComposedService(downloads, transfers)
	patches := &compositiontest.Patches{ByDigest: map[string]moyu.Entry{}}
	deps := composition.Deps{
		Repo: compositionpg.NewRepository(db.Ent), Bases: composed, Listings: inspection.NewListingService(inspectionRepo), Uploads: uploads, Quota: quota, Spool: uploads,
		Examiner: examiner, Resources: composed, Names: names, Games: cards, Patches: patches, Objects: objects, Archiver: archives,
		Stage: localfs.NewStage(filepath.Join(root, ".compose")), Messages: notices, Queue: notices, Tx: tx, Settings: settings, Now: clock,
	}
	drafts := composition.NewService(deps)
	told := composition.NewNoticeService(notices)
	return composeLine{
		db: db, binary: binary, root: root, shelf: objects, drafts: drafts,
		reads: composition.NewReadService(drafts, examiner, patches, told), runs: composition.NewRunService(deps, told),
		backfill: scan.NewBackfillService(scans, objects, uploads), notices: notices, files: files, now: now,
	}
}

func (l composeLine) archive(t *testing.T, name string, files map[string][]byte) string {
	t.Helper()
	dir := t.TempDir()
	source := filepath.Join(dir, "source")
	tops := map[string]bool{}
	for file, content := range files {
		path := filepath.Join(source, filepath.FromSlash(file))
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, content, 0o600); err != nil {
			t.Fatal(err)
		}
		tops[strings.SplitN(file, "/", 2)[0]] = true
	}
	target := filepath.Join(dir, name)
	args := append([]string{"a", target}, slices.Sorted(maps.Keys(tops))...)
	cmd := exec.CommandContext(t.Context(), l.binary, args...)
	cmd.Dir = source
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("create %s: %v\n%s", name, err, out)
	}
	return target
}

func writtenOnWindows(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var out bytes.Buffer
	writer := zip.NewWriter(&out)
	for _, name := range slices.Sorted(maps.Keys(files)) {
		legacy, err := simplifiedchinese.GBK.NewEncoder().String(name)
		if err != nil {
			t.Fatal(err)
		}
		file, err := writer.CreateHeader(&zip.FileHeader{Name: legacy, NonUTF8: true, Method: zip.Deflate})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(files[name])); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func (l composeLine) original(t *testing.T, gameID int, path string) (int, int) {
	t.Helper()
	ctx := context.Background()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	creator := l.db.User(t)
	resource := l.db.Ent.GameDownloadResource.Create().SetGameID(gameID).SetCreatorID(creator).SetPlatform(pgvalue.Strings{"win"}).SetLanguage(pgvalue.Strings{"jp"}).
		SetForm(string(download.FormPortable)).SetPublishedAt(l.now.Add(-time.Hour)).SaveX(ctx)
	key := fmt.Sprintf("games/%d/%s", resource.ID, filepath.Base(path))
	stored := l.db.Ent.GameDownloadResourceFile.Create().
		SetGameDownloadResourceID(resource.ID).
		SetType(download.FileTypeObjectStore).
		SetFileName(filepath.Base(path)).
		SetS3FileKey(key).
		SetFileSize(info.Size()).
		SetFileHash("legacy").
		SetFileStatus(download.FileInObjectStore).
		SetFileCheckStatus(int(download.CheckOK)).
		SetCreatorID(creator).
		SaveX(ctx)
	l.shelf.objects[key] = path
	if _, found, err := l.backfill.Next(ctx, nil); err != nil || !found {
		t.Fatalf("read the original: %v %v", found, err)
	}
	return resource.ID, stored.ID
}

func (l composeLine) uploaded(t *testing.T, who actor.Actor, name string, content []byte) composition.Upload {
	t.Helper()
	path := filepath.Join(l.root, fmt.Sprintf("%x.part", sha256.Sum256(content)))
	if err := os.WriteFile(path, content, 0o600); err != nil {
		t.Fatal(err)
	}
	session := l.db.Ent.GameUploadSession.Create().SetFileName(name).SetTotalSize(int64(len(content))).SetChunkSize(1 << 20).SetTotalChunks(1).SetFileSha256("unused").
		SetStatus(gameuploadsession.StatusCOMPLETED).SetStoragePath(path).SetExpiresAt(l.now.Add(time.Hour)).SetCreatorID(who.UserID).SaveX(context.Background())
	return composition.Upload{SessionID: session.ID, Name: name}
}

func (l composeLine) read(t *testing.T, id int, role composition.Role) composition.View {
	t.Helper()
	ctx := context.Background()
	if err := l.reads.Read(ctx, composition.Read{CompositionID: id, Role: role}); err != nil {
		t.Fatal(err)
	}
	view, err := l.drafts.Get(ctx, actor.Actor{UserID: 1, Role: actor.RoleAdmin}, id)
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func (l composeLine) unpacked(t *testing.T, key string) map[string]string {
	t.Helper()
	source, stored := l.shelf.objects[key]
	if !stored {
		t.Fatalf("the bucket does not hold %s: %v", key, slices.Collect(maps.Keys(l.shelf.objects)))
	}
	dir := t.TempDir()
	if out, err := exec.CommandContext(t.Context(), l.binary, "x", "-y", "-o"+dir, source).CombinedOutput(); err != nil {
		t.Fatalf("unpack the result: %v\n%s", err, out)
	}
	found := map[string]string{}
	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		rest, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		digest := sha256.Sum256(content)
		found[norm.NFC.String(filepath.ToSlash(rest))] = hex.EncodeToString(digest[:])
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return found
}

func digestOf(content []byte) string {
	digest := sha256.Sum256(content)
	return hex.EncodeToString(digest[:])
}

func TestAPatchIsComposedOntoAnOriginalAndAgainWhenThePatchChanges(t *testing.T) {
	binary := sevenZip(t)
	line := newComposeLine(t, binary)
	ctx := context.Background()
	gameID := line.db.Game(t)
	data := bytes.Repeat([]byte("d"), 4096)
	original := line.archive(t, "original (files).7z", map[string][]byte{
		"ライムライト/game.exe":            []byte("MZ game"),
		"ライムライト/patch.xp3":           []byte("japanese script"),
		"ライムライト/data.xp3":            data,
		"ライムライト/savedata/readme.txt": []byte("saves go here"),
	})
	untouched, err := os.ReadFile(original)
	if err != nil {
		t.Fatal(err)
	}
	baseID, baseFile := line.original(t, gameID, original)
	who := actor.Actor{UserID: line.db.User(t), Role: actor.RoleUser}

	candidates, err := line.drafts.Candidates(ctx, who, gameID)
	if err != nil || len(candidates) != 1 || candidates[0].Reason != nil || candidates[0].Base.ResourceID != baseID {
		t.Fatalf("the original can be composed on: %+v %v", candidates, err)
	}
	draft, err := line.drafts.Begin(ctx, who, gameID, baseID)
	if err != nil {
		t.Fatal(err)
	}
	firstPatch := writtenOnWindows(t, map[string]string{
		"汉化补丁/patch.xp3":  "chinese script",
		"汉化补丁/游戏_chs.exe": "MZ chinese",
		"汉化补丁/说明.txt":     "read me",
	})
	if _, err := line.drafts.Attach(ctx, who, draft.ID, composition.RolePatch, line.uploaded(t, who, "汉化补丁_v1.1.zip", firstPatch)); err != nil {
		t.Fatal(err)
	}
	planned := line.read(t, draft.ID, composition.RolePatch)
	if planned.Patch.State != composition.InputReady || planned.Plan == nil {
		t.Fatalf("the patch is read: %+v", planned.Patch)
	}
	plan := planned.Plan
	if plan.GameDir != "ライムライト" || plan.PatchDir != "汉化补丁" || plan.Adds.Files != 2 || plan.Replaces.Files != 1 || plan.Unchanged.Files != 3 || plan.Total.Files != 6 || len(plan.Conflicts) != 0 {
		t.Fatalf("what the patch changes: %+v", plan)
	}
	languages, translators, group := []string{"zh"}, []string{"绿茶汉化组"}, ptr(download.TranslationGroup)
	if _, err := line.drafts.Edit(ctx, who, draft.ID, composition.Changes{Languages: &languages, Translation: &group, Translators: &translators, PatchVersion: ptr(ptr("v1.1"))}); err != nil {
		t.Fatal(err)
	}
	save := writtenOnWindows(t, map[string]string{"savedata/data0.sav": "all scenes"})
	if _, err := line.drafts.Attach(ctx, who, draft.ID, composition.RoleSave, line.uploaded(t, who, "savedata.zip", save)); err != nil {
		t.Fatal(err)
	}
	if saved := line.read(t, draft.ID, composition.RoleSave); saved.Save.State != composition.InputReady {
		t.Fatalf("the save is read: %+v", saved.Save)
	}
	started, err := line.drafts.Start(ctx, who, draft.ID)
	if err != nil || started.State != composition.StateQueued || started.ResourceID == nil {
		t.Fatalf("a started composition: %+v %v", started, err)
	}
	resourceID := *started.ResourceID
	if waiting := line.db.Ent.GameDownloadResource.GetX(ctx, resourceID); waiting.PublishedAt != nil {
		t.Fatalf("the resource waits for its file: %+v", waiting)
	}
	if err := line.runs.Run(ctx, draft.ID); err != nil {
		t.Fatal(err)
	}

	done := line.read(t, draft.ID, composition.RolePatch)
	if done.State != composition.StateDone || done.OutputSize == nil || done.Failure != nil {
		t.Fatalf("a finished composition: %+v", done.Composition)
	}
	resource := line.db.Ent.GameDownloadResource.GetX(ctx, resourceID)
	if resource.PublishedAt == nil || !slices.Equal(resource.Language, []string{"zh"}) || resource.Translation == nil || *resource.Translation != "group" || resource.PatchVersion == nil || *resource.PatchVersion != "v1.1" ||
		resource.Form == nil || *resource.Form != "portable" || !slices.Equal(resource.Extras, []string{download.ExtraSave}) || resource.CreatorID != who.UserID {
		t.Fatalf("the composed resource: %+v", resource)
	}
	file := line.db.Ent.GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID)).OnlyX(ctx)
	if file.FileStatus != download.FileInObjectStore || file.FileCheckStatus != int(download.CheckOK) || file.InspectionID == nil || file.S3FileKey == nil || file.FileSize != *done.OutputSize ||
		!strings.Contains(file.FileName, "[绿茶汉化组][v1.1]") || !strings.HasSuffix(file.FileName, "(files).7z") {
		t.Fatalf("the composed file: %+v", file)
	}
	packed, err := os.ReadFile(line.shelf.objects[*file.S3FileKey])
	if err != nil || file.FileSha256 == nil || *file.FileSha256 != digestOf(packed) {
		t.Fatalf("the file row carries the digest of what is stored: %v", err)
	}
	want := map[string]string{
		"ライムライト/game.exe":            digestOf([]byte("MZ game")),
		"ライムライト/patch.xp3":           digestOf([]byte("chinese script")),
		"ライムライト/data.xp3":            digestOf(data),
		"ライムライト/savedata/readme.txt": digestOf([]byte("saves go here")),
		"ライムライト/游戏_chs.exe":          digestOf([]byte("MZ chinese")),
		"ライムライト/说明.txt":              digestOf([]byte("read me")),
		"全CG存档/savedata/data0.sav":   digestOf([]byte("all scenes")),
		"汉化补丁/汉化补丁_v1.1.zip":         digestOf(firstPatch),
	}
	if got := line.unpacked(t, *file.S3FileKey); !maps.Equal(got, want) {
		t.Fatalf("what the result holds:\n%v\nwant\n%v", got, want)
	}
	base := line.db.Ent.GameDownloadResourceFile.GetX(ctx, baseFile)
	kept, err := os.ReadFile(line.shelf.objects[*base.S3FileKey])
	if err != nil || !bytes.Equal(kept, untouched) || base.FileStatus != download.FileInObjectStore || line.db.Ent.GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.GameDownloadResourceID(baseID)).CountX(ctx) != 1 {
		t.Fatalf("the original is left as it was: %+v %v", base, err)
	}
	if line.db.Ent.GameDownloadResourceEvent.Query().Where(gamedownloadresourceevent.ResourceID(resourceID), gamedownloadresourceevent.Kind(string(download.EventComposed))).CountX(ctx) != 1 {
		t.Fatal("the history says the resource was composed")
	}
	if told := line.notices.Messages(); len(told) != 1 || told[0].Title != "Messages.System.File.Compose.DoneTitle" || told[0].ReceiverID != who.UserID {
		t.Fatalf("the uploader is told: %+v", told)
	}
	lineage, err := line.drafts.Lineage(ctx, actor.Guest(), resourceID)
	if err != nil || lineage.Latest == nil || lineage.Latest.Base.ResourceID != baseID || lineage.BaseGone || lineage.Current != nil {
		t.Fatalf("what the resource is made of: %+v %v", lineage, err)
	}

	nextPatch := line.archive(t, "汉化补丁_v1.2.7z", map[string][]byte{"patch.xp3": []byte("chinese script, corrected"), "extra.xp3": []byte("more scenes")})
	content, err := os.ReadFile(nextPatch)
	if err != nil {
		t.Fatal(err)
	}
	rebuilt, err := line.drafts.Rebuild(ctx, who, resourceID, composition.RebuildInput{Upload: line.uploaded(t, who, "汉化补丁_v1.2.7z", content), PatchVersion: ptr("v1.2"), Note: ptr("修正第三章的错字")})
	if err != nil || !rebuilt.Rebuild() {
		t.Fatalf("a composition with the new patch: %+v %v", rebuilt, err)
	}
	if queued := line.read(t, rebuilt.ID, composition.RolePatch); queued.State != composition.StateQueued || queued.Plan.GameDir != "ライムライト" || queued.Plan.PatchDir != "" {
		t.Fatalf("it starts once the patch is read: %+v", queued.Composition)
	}
	if during := line.db.Ent.GameDownloadResourceFile.GetX(ctx, file.ID); *during.S3FileKey != *file.S3FileKey || *during.FileSha256 != *file.FileSha256 {
		t.Fatalf("the earlier file is served until the new one is ready: %+v", during)
	}
	if err := line.runs.Run(ctx, rebuilt.ID); err != nil {
		t.Fatal(err)
	}
	again := line.db.Ent.GameDownloadResourceFile.Query().Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID)).OnlyX(ctx)
	if again.ID != file.ID || *again.S3FileKey == *file.S3FileKey || *again.FileSha256 == *file.FileSha256 || *again.InspectionID == *file.InspectionID || !strings.Contains(again.FileName, "[绿茶汉化组][v1.2]") {
		t.Fatalf("the file takes the new content in place: %+v", again)
	}
	want = map[string]string{
		"ライムライト/game.exe":            digestOf([]byte("MZ game")),
		"ライムライト/patch.xp3":           digestOf([]byte("chinese script, corrected")),
		"ライムライト/extra.xp3":           digestOf([]byte("more scenes")),
		"ライムライト/data.xp3":            digestOf(data),
		"ライムライト/savedata/readme.txt": digestOf([]byte("saves go here")),
		"全CG存档/savedata/data0.sav":   digestOf([]byte("all scenes")),
		"汉化补丁/汉化补丁_v1.2.7z":          digestOf(content),
	}
	if got := line.unpacked(t, *again.S3FileKey); !maps.Equal(got, want) {
		t.Fatalf("what the result holds after the new patch:\n%v\nwant\n%v", got, want)
	}
	if renewed := line.db.Ent.GameDownloadResource.GetX(ctx, resourceID); *renewed.PatchVersion != "v1.2" {
		t.Fatalf("the resource says which patch it holds: %+v", renewed)
	}
	if line.db.Ent.GameDownloadResourceEvent.Query().Where(gamedownloadresourceevent.ResourceID(resourceID), gamedownloadresourceevent.Kind(string(download.EventRecomposed))).CountX(ctx) != 1 {
		t.Fatal("the history says the resource was composed again")
	}
	purged := slices.ContainsFunc(line.files.Jobs(), func(job download.Job) bool {
		purge, ok := job.(download.PurgeObjects)
		return ok && slices.Equal(purge.Keys, []string{*file.S3FileKey})
	})
	if !purged {
		t.Fatalf("the earlier object is removed afterwards: %+v", line.files.Jobs())
	}
	if told := line.notices.Messages(); len(told) != 2 || told[1].Title != "Messages.System.File.Compose.RebuiltTitle" {
		t.Fatalf("the uploader is told again: %+v", told)
	}
}
