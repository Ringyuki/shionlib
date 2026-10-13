package composition_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/game/gametest"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	gameID      = 10
	baseID      = 31
	baseFileID  = 310
	baseKey     = "games/10/310/base.7z"
	baseName    = "[250926][ゆずソフト] ライムライト DL版 (files).7z"
	inspected   = 71
	patchUpload = 41
	saveUpload  = 42
	patchName   = "汉化补丁_v1.1.zip"
	saveName    = "savedata.zip"
	wrapper     = "ライムライト"
)

var (
	uploader = actor.Actor{UserID: 1, Role: actor.RoleUser, ContentLimit: actor.ContentLimitJustShow}
	stranger = actor.Actor{UserID: 2, Role: actor.RoleUser}
	admin    = actor.Actor{UserID: 3, Role: actor.RoleAdmin}
	started  = time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
)

type fixture struct {
	clock     *time.Time
	repo      *compositiontest.MemoryRepository
	bases     *compositiontest.Bases
	listings  *compositiontest.Listings
	stage     *compositiontest.Stage
	uploads   *compositiontest.Uploads
	quota     *compositiontest.Quota
	spool     *compositiontest.Spool
	examiner  *compositiontest.Examiner
	resources *compositiontest.Resources
	patches   *compositiontest.Patches
	objects   *compositiontest.Objects
	archiver  *compositiontest.Archiver
	events    *compositiontest.Recorder
	settings  settingtest.Source
	service   *composition.Service
	reads     *composition.ReadService
	runs      *composition.RunService
	cleaner   *composition.CleanService

	harmfulResult bool
	brokenResult  bool
}

func ptr[T any](value T) *T {
	return &value
}

func expectCode(t *testing.T, err error, want apperror.Definition) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Fatalf("got %v, want %s", err, want.Name())
	}
}

func stored(id int, name string, size int64, read *int) download.GameFile {
	key := "games/10/" + name
	return download.GameFile{File: download.File{ID: id, Name: name, Size: size, Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK, StorageKey: &key, InspectionID: read}}
}

func original(id int, form *download.Form, files ...download.GameFile) download.GameResource {
	published := started.Add(-48 * time.Hour)
	return download.GameResource{
		Resource: download.Resource{ID: id, GameID: gameID, Status: download.ResourceActive, Platforms: []string{"win"}, Languages: []string{"jp"}, Info: download.Info{Form: form}, CreatorID: 9, PublishedAt: &published},
		Files:    files,
	}
}

func baseResource() download.GameResource {
	key := baseKey
	file := stored(baseFileID, baseName, 6500, ptr(inspected))
	file.StorageKey = &key
	return original(baseID, ptr(download.FormPortable), file)
}

func newFixture() *fixture {
	clock := started
	stage := compositiontest.NewStage()
	f := &fixture{
		clock:     &clock,
		repo:      compositiontest.NewMemoryRepository(func() time.Time { return clock }),
		bases:     &compositiontest.Bases{Resources: map[int]download.GameResource{baseID: baseResource()}},
		stage:     stage,
		quota:     &compositiontest.Quota{Allowances: map[int]upload.Allowance{uploader.UserID: {InFlightLimit: 1 << 40}, admin.UserID: {InFlightLimit: 1 << 40}}},
		spool:     &compositiontest.Spool{Room: 1 << 40},
		examiner:  &compositiontest.Examiner{Findings: map[string]scan.LocalFinding{}},
		resources: &compositiontest.Resources{Files: map[int]download.GameResource{}},
		patches:   &compositiontest.Patches{ByDigest: map[string]moyu.Entry{}},
		events:    &compositiontest.Recorder{},
		settings:  settingtest.Source{},
	}
	f.listings = &compositiontest.Listings{
		Inspections: map[int]inspection.Inspection{inspected: {ID: inspected, Status: inspection.StatusReady, Totals: inspection.Totals{Files: 4, Size: 7000}}},
		Paths: map[int][]inspection.FilePath{inspected: {
			{Path: wrapper + "/LimelightLemonadeJam.exe", Size: 900},
			{Path: wrapper + "/patch.xp3", Size: 121},
			{Path: wrapper + "/data.xp3", Size: 5000},
			{Path: wrapper + "/savedata/readme.txt", Size: 3},
		}},
	}
	f.uploads = &compositiontest.Uploads{Stage: stage, Sessions: map[int]upload.Session{
		patchUpload: {ID: patchUpload, FileName: patchName, TotalSize: 850, Status: upload.StatusCompleted, CreatorID: uploader.UserID},
		saveUpload:  {ID: saveUpload, FileName: saveName, TotalSize: 36, Status: upload.StatusCompleted, CreatorID: uploader.UserID},
	}}
	f.examiner.Findings[patchName] = scan.LocalFinding{Status: download.CheckOK, Format: "zip", Container: true, SHA256: "patch-sha", Unpacked: 1919, Files: []scan.LocalEntry{
		{Path: "汉化补丁 v1.1/LimelightLemonadeJam_chs.exe", Size: 942},
		{Path: "汉化补丁 v1.1/patch.xp3", Size: 146},
		{Path: "汉化补丁 v1.1/patch_chs.xp3", Size: 828},
		{Path: "汉化补丁 v1.1/汉化说明.txt", Size: 3},
	}}
	f.examiner.Findings[saveName] = scan.LocalFinding{Status: download.CheckOK, Format: "zip", Container: true, SHA256: "save-sha", Unpacked: 64, Files: []scan.LocalEntry{{Path: "savedata/data0.sav", Size: 32}, {Path: "savedata/data1.sav", Size: 32}}}
	f.objects = &compositiontest.Objects{Stage: stage, Sizes: map[string]int64{baseKey: 6500}, Missing: map[string]bool{}}
	f.archiver = &compositiontest.Archiver{Stage: stage, Unreadable: map[string]bool{}, Contents: map[string][]composition.Node{
		baseName: {
			{Path: wrapper + "/LimelightLemonadeJam.exe", Size: 900},
			{Path: wrapper + "/patch.xp3", Size: 121},
			{Path: wrapper + "/data.xp3", Size: 5000},
			{Path: wrapper + "/savedata/readme.txt", Size: 3},
		},
		patchName: {
			{Path: "汉化补丁 v1.1/LimelightLemonadeJam_chs.exe", Size: 942},
			{Path: "汉化补丁 v1.1/PATCH.XP3", Size: 146},
			{Path: "汉化补丁 v1.1/patch_chs.xp3", Size: 828},
			{Path: "汉化补丁 v1.1/汉化说明.txt", Size: 3},
		},
		saveName: {{Path: "savedata/data0.sav", Size: 32}, {Path: "savedata/data1.sav", Size: 32}},
	}}
	deps := composition.Deps{
		Repo:      f.repo,
		Bases:     f.bases,
		Listings:  f.listings,
		Uploads:   f.uploads,
		Quota:     f.quota,
		Spool:     f.spool,
		Examiner:  f.examiner,
		Resources: f.resources,
		Names:     compositiontest.Names{},
		Games:     gametest.NewCards(game.Card{ID: gameID, TitleJP: "ライムライト・レモネードジャム"}),
		Patches:   f.patches,
		Objects:   f.objects,
		Archiver:  f.archiver,
		Stage:     f.stage,
		Messages:  f.events,
		Queue:     f.events,
		Tx:        &txtest.Immediate{},
		Settings:  f.settings,
		Now:       func() time.Time { return clock },
	}
	notices := composition.NewNoticeService(f.events)
	f.service = composition.NewService(deps)
	f.reads = composition.NewReadService(f.service, f.examiner, f.patches, notices)
	f.runs = composition.NewRunService(deps, notices)
	f.cleaner = composition.NewCleanService(f.service)
	return f
}

func (f *fixture) pass(d time.Duration) {
	*f.clock = f.clock.Add(d)
}

func (f *fixture) begin(t *testing.T) composition.View {
	t.Helper()
	view, err := f.service.Begin(context.Background(), uploader, gameID, baseID)
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func (f *fixture) read(t *testing.T, id int, role composition.Role) {
	t.Helper()
	if err := f.reads.Read(context.Background(), composition.Read{CompositionID: id, Role: role}); err != nil {
		t.Fatal(err)
	}
}

func (f *fixture) described(t *testing.T) composition.View {
	t.Helper()
	ctx := context.Background()
	draft := f.begin(t)
	if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	f.read(t, draft.ID, composition.RolePatch)
	group := download.TranslationGroup
	view, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{
		Languages:    ptr([]string{"zh"}),
		Translation:  ptr(&group),
		Translators:  ptr([]string{"Can/need汉化组", "破琵琶生产公社汉化组"}),
		PatchVersion: ptr(ptr("v1.1")),
	})
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func (f *fixture) queued(t *testing.T) composition.View {
	t.Helper()
	view, err := f.service.Start(context.Background(), uploader, f.described(t).ID)
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func (f *fixture) stored(t *testing.T, id int) composition.Composition {
	t.Helper()
	found, err := f.repo.Get(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return found
}

func refusedFinding(status download.CheckStatus) scan.LocalFinding {
	return scan.LocalFinding{Status: status}
}

func plainFinding() scan.LocalFinding {
	return scan.LocalFinding{Status: download.CheckOK, Format: "pe", SHA256: "plain"}
}

func harmfulFinding() scan.LocalFinding {
	return scan.LocalFinding{Status: download.CheckOK, Format: "zip", Container: true, SHA256: "harm", Viruses: []string{"Eicar"}, Detections: []inspection.Detection{{Path: "汉化补丁 v1.1/chs.exe", Signature: "Eicar"}}}
}

func emptyPatch() scan.LocalFinding {
	return scan.LocalFinding{Status: download.CheckOK, Format: "zip", Container: true, SHA256: "empty", Files: []scan.LocalEntry{}}
}

type holdingArchiver struct {
	*compositiontest.Archiver
	stage  *compositiontest.Stage
	packed []string
	sizes  map[string]int64
}

func (h *holdingArchiver) Pack(ctx context.Context, in composition.Packing, observe func(percent int)) error {
	h.packed = h.stage.Files(in.Root)
	h.sizes = map[string]int64{}
	for _, name := range h.packed {
		size, err := h.stage.Size(ctx, in.Root+"/"+name)
		if err != nil {
			return err
		}
		h.sizes[name] = size
	}
	return h.Archiver.Pack(ctx, in, observe)
}

func (f *fixture) runsWith(archiver composition.Archiver) *composition.RunService {
	clock := f.clock
	deps := composition.Deps{
		Repo: f.repo, Bases: f.bases, Listings: f.listings, Uploads: f.uploads, Quota: f.quota, Spool: f.spool, Examiner: f.examiner, Resources: f.resources,
		Names: compositiontest.Names{}, Patches: f.patches, Objects: f.objects, Archiver: archiver, Stage: f.stage, Messages: f.events, Queue: f.events,
		Tx: &txtest.Immediate{}, Settings: f.settings, Now: func() time.Time { return *clock },
	}
	return composition.NewRunService(deps, composition.NewNoticeService(f.events))
}

func (f *fixture) grow() {
	f.archiver.Contents[baseName] = append(f.archiver.Contents[baseName], composition.Node{Path: wrapper + "/movie.dat", Size: 2 << 30})
}

func (f *fixture) arrangeResult(name string) {
	switch {
	case f.harmfulResult:
		f.examiner.Findings[name] = scan.LocalFinding{Status: download.CheckOK, Format: "7z", Container: true, Viruses: []string{"Eicar"}, Detections: []inspection.Detection{{Path: "ライムライト/chs.exe", Signature: "Eicar"}}}
	case f.brokenResult:
		f.examiner.Findings[name] = scan.LocalFinding{Status: download.CheckBrokenOrTruncated}
	}
}

func (f *fixture) queuedWith(t *testing.T, session int) composition.View {
	t.Helper()
	ctx := context.Background()
	draft := f.begin(t)
	if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: session, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	f.read(t, draft.ID, composition.RolePatch)
	group := download.TranslationGroup
	if _, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{Languages: ptr([]string{"zh"}), Translation: ptr(&group), Translators: ptr([]string{"绿茶汉化组"})}); err != nil {
		t.Fatal(err)
	}
	view, err := f.service.Start(ctx, uploader, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	return view
}

type swappingExaminer struct {
	*compositiontest.Examiner
	swap func()
	done bool
}

func (s *swappingExaminer) Examine(ctx context.Context, file scan.LocalFile, record bool) (scan.LocalFinding, error) {
	finding, err := s.Examiner.Examine(ctx, file, record)
	if !s.done {
		s.done = true
		s.swap()
	}
	return finding, err
}
