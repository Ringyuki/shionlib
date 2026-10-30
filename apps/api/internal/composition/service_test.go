package composition_test

import (
	"context"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestWhichResourcesOfAGameCanBeComposedOn(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	read := func(id int, size int64, status inspection.Status) *int {
		f.listings.Inspections[id] = inspection.Inspection{ID: id, Status: status, Totals: inspection.Totals{Size: size}}
		return &id
	}
	portable, disc, installer := download.FormPortable, download.FormDisc, download.FormInstaller
	f.bases.Resources[32] = original(32, &disc, stored(320, "disc.7z", 10, read(72, 10, inspection.StatusReady)))
	f.bases.Resources[33] = original(33, &installer, stored(330, "setup.7z", 10, read(73, 10, inspection.StatusReady)))
	f.bases.Resources[34] = original(34, nil, stored(340, "unknown.7z", 10, read(74, 10, inspection.StatusReady)))
	f.bases.Resources[35] = original(35, &portable, stored(350, "unread.7z", 10, nil))
	f.bases.Resources[36] = original(36, &portable, stored(360, "huge.7z", 10, read(76, composition.MaxUnpackedSize.Read(f.settings)+1, inspection.StatusReady)))
	f.bases.Resources[37] = original(37, &portable, stored(370, "failed.7z", 10, read(77, 10, inspection.StatusFailed)))
	f.bases.Resources[38] = original(38, &portable, stored(380, "composed.7z", 10, read(78, 10, inspection.StatusReady)))
	pending := stored(390, "pending.7z", 10, read(79, 10, inspection.StatusReady))
	pending.Status = download.FileOnServer
	f.bases.Resources[39] = original(39, &portable, pending)
	made, _ := f.repo.Create(ctx, composition.NewComposition{GameID: gameID, CreatorID: uploader.UserID, ResourceID: ptr(38)})
	if made.ID == 0 {
		t.Fatal("seed a composed resource")
	}

	candidates, err := f.service.Candidates(ctx, uploader, gameID)
	if err != nil || len(candidates) != 9 {
		t.Fatalf("candidates: %d %v", len(candidates), err)
	}
	want := map[int]composition.Unusable{
		32: composition.UnusableDisc, 33: composition.UnusableInstaller, 34: composition.UnusableUnknown, 35: composition.UnusableUnread,
		36: composition.UnusableTooLarge, 37: composition.UnusableUnreadable, 38: composition.UnusableComposed, 39: composition.UnusablePending,
	}
	for _, candidate := range candidates {
		reason, unusable := want[candidate.Resource.ID]
		switch {
		case !unusable && (candidate.Reason != nil || candidate.Base.InspectionID != inspected || candidate.Base.Size != 6500 || candidate.Base.Unpacked != 7000 || !slices.Equal(candidate.Base.FileIDs, []int{baseFileID})):
			t.Fatalf("the usable original: %+v", candidate)
		case unusable && (candidate.Reason == nil || *candidate.Reason != reason):
			t.Fatalf("resource %d: got %v, want %s", candidate.Resource.ID, candidate.Reason, reason)
		}
	}
	for id := range want {
		_, err := f.service.Begin(ctx, uploader, gameID, id)
		expectCode(t, err, composition.ErrBaseUnusable)
	}
	_, err = f.service.Begin(ctx, uploader, gameID, 999)
	expectCode(t, err, composition.ErrBaseGone)
	_, err = f.service.Begin(ctx, uploader, gameID+1, baseID)
	expectCode(t, err, composition.ErrBaseGone)
}

func TestADraftBelongsToWhoBeganIt(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	draft := f.begin(t)
	if draft.State != composition.StateDraft || !draft.KeepPatch || draft.Base.Name != baseName || draft.Plan != nil || draft.FileName != "" {
		t.Fatalf("a new draft: %+v", draft)
	}
	if want := draft.Updated.Add(composition.DraftTTL.Read(f.settings)); draft.DiscardAt == nil || !draft.DiscardAt.Equal(want) {
		t.Fatalf("a draft untouched for the retention period is cleared at %v: %v", want, draft.DiscardAt)
	}
	_, err := f.service.Get(ctx, stranger, draft.ID)
	expectCode(t, err, composition.ErrNotOwner)
	if _, err := f.service.Get(ctx, admin, draft.ID); err != nil {
		t.Fatalf("an administrator sees it: %v", err)
	}
	_, err = f.service.Get(ctx, uploader, 999)
	expectCode(t, err, composition.ErrNotFound)
	_, err = f.service.Edit(ctx, stranger, draft.ID, composition.Changes{KeepPatch: ptr(false)})
	expectCode(t, err, composition.ErrNotOwner)
}

func TestNothingIsComposedWhileFileChecksAreOff(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	done := f.composed(t)
	f.examiner.Off = true
	_, err := f.service.Begin(ctx, uploader, gameID, baseID)
	expectCode(t, err, composition.ErrChecksOff)
	_, err = f.service.Rebuild(ctx, uploader, *done.ResourceID, composition.RebuildInput{Upload: composition.Upload{SessionID: nextUpload, Name: nextPatch}})
	expectCode(t, err, composition.ErrChecksOff)
}

func TestAttachingThePatchReadsItAndDrawsThePlan(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	draft := f.begin(t)
	attached, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName})
	if err != nil {
		t.Fatal(err)
	}
	input := compositiontest.StageRoot + "/1/inputs/patch/" + patchName
	if attached.Patch == nil || attached.Patch.State != composition.InputReading || attached.Patch.Path != input || attached.Patch.Size != 850 || !f.stage.Has(input) {
		t.Fatalf("the upload is taken into the stage: %+v", attached.Patch)
	}
	if jobs := f.events.Jobs(); len(jobs) != 1 || jobs[0] != (composition.Read{CompositionID: draft.ID, Role: composition.RolePatch}) {
		t.Fatalf("reading is queued: %+v", jobs)
	}
	_, err = f.service.Start(ctx, uploader, draft.ID)
	expectCode(t, err, composition.ErrNotReady)

	f.read(t, draft.ID, composition.RolePatch)
	view, err := f.service.Get(ctx, uploader, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !view.Patch.Ready() || view.Patch.SHA256 != "patch-sha" || view.Patch.Files != 4 || view.Patch.Unpacked != 1919 {
		t.Fatalf("the patch once read: %+v", view.Patch)
	}
	plan := view.Plan
	if plan == nil || plan.Folder != wrapper || plan.GameDir != wrapper || plan.PatchDir != "汉化补丁 v1.1" || plan.Adds.Files != 3 || plan.Replaces.Files != 1 || plan.Total.Files != 7 {
		t.Fatalf("plan: %+v", plan)
	}
	want := []composition.Folder{{Role: composition.FolderGame, Name: wrapper, Items: 7, Size: plan.Total.Size}, {Role: composition.FolderPatch, Name: composition.PatchFolder, Items: 1, Size: 850}}
	if !slices.Equal(view.Folders, want) {
		t.Fatalf("what the archive will hold: %+v", view.Folders)
	}

	root := composition.Root
	moved, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{PatchDir: ptr(&root), KeepPatch: ptr(false)})
	if err != nil || moved.Plan.PatchDir != composition.Root || moved.Plan.Adds.Files != 4 || moved.Plan.Replaces.Files != 0 || len(moved.Folders) != 1 {
		t.Fatalf("another folder of the patch redraws the plan: %+v %v", moved.Plan, err)
	}
	back, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{PatchDir: ptr[*string](nil)})
	if err != nil || back.Plan.PatchDir != "汉化补丁 v1.1" {
		t.Fatalf("without a choice the place is found again: %+v %v", back.Plan, err)
	}
}

func TestDetailsNameTheFileAndASaveIsAnotherFolder(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	view := f.described(t)
	if view.FileName != "game10 Can／need汉化组 破琵琶生产公社汉化组 v1.1.7z" {
		t.Fatalf("the name the file will get: %q", view.FileName)
	}
	if _, err := f.service.Attach(ctx, uploader, view.ID, composition.RoleSave, composition.Upload{SessionID: saveUpload, Name: saveName}); err != nil {
		t.Fatal(err)
	}
	_, err := f.service.Start(ctx, uploader, view.ID)
	expectCode(t, err, composition.ErrNotReady)
	f.read(t, view.ID, composition.RoleSave)
	with, err := f.service.Get(ctx, uploader, view.ID)
	if err != nil || len(with.Folders) != 3 || with.Folders[1] != (composition.Folder{Role: composition.FolderSave, Name: composition.SaveFolder, Items: 2, Size: 64}) {
		t.Fatalf("with a save: %+v %v", with.Folders, err)
	}
	if with.Plan == nil || with.Plan.Adds.Files != 3 {
		t.Fatalf("reading the save leaves the plan alone: %+v", with.Plan)
	}
	without, err := f.service.Detach(ctx, uploader, view.ID, composition.RoleSave)
	if err != nil || without.Save != nil || len(without.Folders) != 2 || f.stage.Has(compositiontest.StageRoot+"/1/inputs/save/"+saveName) {
		t.Fatalf("without the save: %+v %v", without.Folders, err)
	}
}

func TestAPatchThatCannotBeUsedSaysWhy(t *testing.T) {
	ctx := context.Background()
	cases := map[composition.Refusal]func(f *fixture){
		composition.RefusalEncrypted:  func(f *fixture) { f.examiner.Findings[patchName] = refusedFinding(download.CheckEncrypted) },
		composition.RefusalBroken:     func(f *fixture) { f.examiner.Findings[patchName] = refusedFinding(download.CheckBrokenOrTruncated) },
		composition.RefusalNotArchive: func(f *fixture) { f.examiner.Findings[patchName] = plainFinding() },
		composition.RefusalHarmful:    func(f *fixture) { f.examiner.Findings[patchName] = harmfulFinding() },
	}
	for refusal, arrange := range cases {
		f := newFixture()
		arrange(f)
		draft := f.begin(t)
		if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
			t.Fatal(err)
		}
		f.read(t, draft.ID, composition.RolePatch)
		view, _ := f.service.Get(ctx, uploader, draft.ID)
		if view.Patch.State != composition.InputRefused || view.Patch.Refusal == nil || *view.Patch.Refusal != refusal || view.Plan != nil {
			t.Fatalf("%s: %+v", refusal, view.Patch)
		}
		if refusal == composition.RefusalHarmful && !slices.Equal(view.Patch.Viruses, []string{"Eicar"}) {
			t.Fatalf("what was found: %v", view.Patch.Viruses)
		}
		_, err := f.service.Start(ctx, uploader, draft.ID)
		expectCode(t, err, composition.ErrNotReady)
	}
}

func TestStartingCreatesTheResourceAndQueuesTheWork(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	draft := f.described(t)
	started, err := f.service.Start(ctx, uploader, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if started.State != composition.StateQueued || started.ResourceID == nil || *started.ResourceID != 501 || started.QueuedAt == nil || started.OutputName != draft.FileName || started.Ahead != 0 {
		t.Fatalf("a queued composition: %+v", started.Composition)
	}
	begun := f.resources.Begun
	if len(begun) != 1 || begun[0].GameID != gameID || !slices.Equal(begun[0].Platforms, []string{"win"}) || !slices.Equal(begun[0].Languages, []string{"zh"}) {
		t.Fatalf("the resource takes its platform from the original and its language from the patch: %+v", begun)
	}
	info := begun[0].Info
	if *info.Translation != download.TranslationGroup || len(info.Translators) != 2 || *info.PatchVersion != "v1.1" || *info.Form != download.FormPortable || len(info.Extras) != 0 {
		t.Fatalf("its information: %+v", info)
	}
	jobs := f.events.Jobs()
	if last := jobs[len(jobs)-1]; last != (composition.Run{CompositionID: draft.ID}) {
		t.Fatalf("the work is queued: %+v", jobs)
	}
	_, err = f.service.Start(ctx, uploader, draft.ID)
	expectCode(t, err, composition.ErrNotDraft)
	_, err = f.service.Edit(ctx, uploader, draft.ID, composition.Changes{KeepPatch: ptr(false)})
	expectCode(t, err, composition.ErrNotDraft)
	expectCode(t, f.service.Discard(ctx, uploader, draft.ID), composition.ErrBusy)

	second := newFixture()
	other := second.described(t)
	if _, err := second.service.Attach(ctx, uploader, other.ID, composition.RoleSave, composition.Upload{SessionID: saveUpload, Name: saveName}); err != nil {
		t.Fatal(err)
	}
	second.read(t, other.ID, composition.RoleSave)
	if _, err := second.service.Start(ctx, uploader, other.ID); err != nil || !slices.Equal(second.resources.Begun[0].Info.Extras, []string{download.ExtraSave}) {
		t.Fatalf("a save is named among the extras: %+v %v", second.resources.Begun, err)
	}
}

func TestWhatKeepsACompositionFromStarting(t *testing.T) {
	ctx := context.Background()
	t.Run("a patch that changes nothing", func(t *testing.T) {
		f := newFixture()
		f.examiner.Findings[patchName] = emptyPatch()
		_, err := f.service.Start(ctx, uploader, f.described(t).ID)
		expectCode(t, err, composition.ErrNothingToApply)
	})
	t.Run("a file where the game has a folder", func(t *testing.T) {
		f := newFixture()
		draft := f.described(t)
		root := composition.Root
		f.listings.Paths[inspected] = append(f.listings.Paths[inspected], f.listings.Paths[inspected][0])
		f.listings.Paths[inspected][4].Path = "汉化补丁 v1.1/patch.xp3/inner.bin"
		if _, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{GameDir: ptr(&root), PatchDir: ptr(&root)}); err != nil {
			t.Fatal(err)
		}
		_, err := f.service.Start(ctx, uploader, draft.ID)
		expectCode(t, err, composition.ErrPathConflict)
	})
	t.Run("a full queue", func(t *testing.T) {
		f := newFixture()
		f.settings[composition.QueueLimit.Name()] = 1
		f.queued(t)
		f.uploads.Sessions[patchUpload] = upload.Session{ID: patchUpload, FileName: patchName, TotalSize: 850, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
		_, err := f.service.Start(ctx, uploader, f.described(t).ID)
		expectCode(t, err, composition.ErrQueueFull)
	})
	t.Run("no storage left", func(t *testing.T) {
		f := newFixture()
		f.quota.Allowances[uploader.UserID] = upload.Allowance{Stored: 90, StoredLimit: ptr[int64](100), InFlightLimit: 1 << 40}
		_, err := f.service.Start(ctx, uploader, f.described(t).ID)
		expectCode(t, err, upload.ErrQuotaExceeded)
	})
	t.Run("an original that is gone", func(t *testing.T) {
		f := newFixture()
		draft := f.described(t)
		delete(f.bases.Resources, baseID)
		_, err := f.service.Start(ctx, uploader, draft.ID)
		expectCode(t, err, composition.ErrBaseGone)
		if len(f.resources.Begun) != 0 {
			t.Fatal("no resource is created for a composition that does not start")
		}
	})
	t.Run("a translation that does not say where it comes from", func(t *testing.T) {
		f := newFixture()
		draft := f.described(t)
		if _, err := f.service.Edit(ctx, uploader, draft.ID, composition.Changes{Translation: ptr[*download.Translation](nil)}); err != nil {
			t.Fatal(err)
		}
		if _, err := f.service.Start(ctx, uploader, draft.ID); err == nil || f.stored(t, draft.ID).State != composition.StateDraft {
			t.Fatalf("the resource refuses it and the draft stays: %v", err)
		}
	})
}

func TestADraftOrAFailedCompositionCanBeDiscarded(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	draft := f.described(t)
	expectCode(t, f.service.Discard(ctx, stranger, draft.ID), composition.ErrNotOwner)
	if err := f.service.Discard(ctx, uploader, draft.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(ctx, draft.ID); err == nil || f.stage.Has(compositiontest.StageRoot+"/1") || len(f.resources.Discarded) != 0 {
		t.Fatalf("the draft and its files are gone: %v", err)
	}

	failed := newFixture()
	queued := failed.queued(t)
	delete(failed.bases.Resources, baseID)
	if err := failed.runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	if err := failed.service.Discard(ctx, uploader, queued.ID); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(failed.resources.Discarded, []int{501}) {
		t.Fatalf("the resource that never got its file goes with it: %v", failed.resources.Discarded)
	}
}

func TestWhatACompositionShowsOfItself(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	first := f.queued(t)
	f.uploads.Sessions[patchUpload] = upload.Session{ID: patchUpload, FileName: patchName, TotalSize: 850, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
	f.pass(1)
	second := f.queued(t)
	if second.Ahead != 1 {
		t.Fatalf("one composition waits before it: %d", second.Ahead)
	}
	draft := f.begin(t)
	active, err := f.service.Active(ctx, uploader)
	if err != nil || len(active) != 2 || active[0].ID != second.ID || active[1].ID != first.ID {
		t.Fatalf("what is queued, newest first, without drafts (%d): %+v %v", draft.ID, active, err)
	}
	if others, err := f.service.Active(ctx, stranger); err != nil || len(others) != 0 {
		t.Fatalf("someone else's list: %+v %v", others, err)
	}

	lineage, err := f.service.Lineage(ctx, uploader, *first.ResourceID)
	if err != nil || lineage.Current == nil || lineage.Current.ID != first.ID || lineage.Latest != nil {
		t.Fatalf("a resource being composed: %+v %v", lineage, err)
	}
	if hidden, err := f.service.Lineage(ctx, stranger, *first.ResourceID); err != nil || hidden.Current != nil {
		t.Fatalf("its progress is the owner's alone: %+v %v", hidden, err)
	}
	if none, err := f.service.Lineage(ctx, uploader, 999); err != nil || none.Current != nil || none.Latest != nil {
		t.Fatalf("a resource that was uploaded: %+v %v", none, err)
	}
}
