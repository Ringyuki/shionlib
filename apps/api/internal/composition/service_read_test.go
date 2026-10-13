package composition_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	composedFile = 5010
	nextUpload   = 43
	nextPatch    = "汉化补丁_v1.2.zip"
)

func (f *fixture) composed(t *testing.T) composition.Composition {
	t.Helper()
	ctx := context.Background()
	queued := f.withSave(t)
	if err := f.runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	done := f.stored(t, queued.ID)
	published := started
	file := stored(composedFile, done.OutputName, *done.OutputSize, ptr(901))
	f.resources.Files[*done.ResourceID] = download.GameResource{
		Resource: download.Resource{ID: *done.ResourceID, GameID: gameID, Status: download.ResourceActive, CreatorID: uploader.UserID, PublishedAt: &published},
		Files:    []download.GameFile{file},
	}
	f.uploads.Sessions[nextUpload] = upload.Session{ID: nextUpload, FileName: nextPatch, TotalSize: 857, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
	f.examiner.Findings[nextPatch] = scan.LocalFinding{Status: download.CheckOK, Format: "zip", Container: true, SHA256: "next-sha", Unpacked: 150, Files: []scan.LocalEntry{{Path: "patch.xp3", Size: 150}}}
	f.archiver.Contents[nextPatch] = []composition.Node{{Path: "patch.xp3", Size: 150}}
	return done
}

func (f *fixture) rebuild(t *testing.T, done composition.Composition) composition.View {
	t.Helper()
	view, err := f.service.Rebuild(context.Background(), uploader, *done.ResourceID, composition.RebuildInput{Upload: composition.Upload{SessionID: nextUpload, Name: nextPatch}, PatchVersion: ptr("v1.2"), Note: ptr("修正第三章的错字")})
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func TestReadingMatchesThePatchWithWhatTheOtherSiteLists(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	f.patches.ByDigest["patch-sha"] = moyu.Entry{ID: "r1", Translator: "Can／need×ポッピンパーティ生産公社&V1.1", URL: "https://www.moyu.moe/resource/9919"}
	draft := f.begin(t)
	if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	f.read(t, draft.ID, composition.RolePatch)
	match := f.stored(t, draft.ID).Match
	if match == nil || !slices.Equal(match.Translators, []string{"Can／need", "ポッピンパーティ生産公社"}) || match.Version == nil || *match.Version != "V1.1" || match.URL != "https://www.moyu.moe/resource/9919" {
		t.Fatalf("match: %+v", match)
	}
	if details := f.stored(t, draft.ID).Details; len(details.Translators) != 0 || details.PatchVersion != nil {
		t.Fatalf("what is filled in stays the uploader's to decide: %+v", details)
	}

	plain := composition.MatchOf(moyu.Entry{Translator: " 绿茶汉化组 ", URL: "https://www.moyu.moe/resource/1"})
	if !slices.Equal(plain.Translators, []string{"绿茶汉化组"}) || plain.Version != nil {
		t.Fatalf("a group without a version: %+v", plain)
	}
	named := composition.MatchOf(moyu.Entry{Translator: "A&B汉化组"})
	if !slices.Equal(named.Translators, []string{"A&B汉化组"}) || named.Version != nil {
		t.Fatalf("an ampersand in a name is not a version: %+v", named)
	}
	if none := composition.MatchOf(moyu.Entry{}); len(none.Translators) != 0 {
		t.Fatalf("no group named: %+v", none)
	}

	failing := newFixture()
	failing.patches.Err = errors.New("the lookup failed")
	other := failing.begin(t)
	if _, err := failing.service.Attach(ctx, uploader, other.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	if err := failing.reads.Read(ctx, composition.Read{CompositionID: other.ID, Role: composition.RolePatch}); err == nil {
		t.Fatal("a lookup that fails is tried again")
	}
	if waiting := failing.stored(t, other.ID); waiting.Patch.State != composition.InputReading {
		t.Fatalf("the patch waits for the next try: %+v", waiting.Patch)
	}
	failing.patches.Err = nil
	failing.read(t, other.ID, composition.RolePatch)
	if read := failing.stored(t, other.ID); !read.Patch.Ready() || read.Match != nil || read.Plan == nil {
		t.Fatalf("the patch is read on the next try: %+v", read.Patch)
	}
}

func TestAReadingThatComesTooLateChangesNothing(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	draft := f.begin(t)
	if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	f.uploads.Sessions[nextUpload] = upload.Session{ID: nextUpload, FileName: nextPatch, TotalSize: 857, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
	hold := &swappingExaminer{Examiner: f.examiner, swap: func() {
		if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RolePatch, composition.Upload{SessionID: nextUpload, Name: nextPatch}); err != nil {
			t.Fatal(err)
		}
	}}
	reads := composition.NewReadService(f.service, hold, f.patches, composition.NewNoticeService(f.events))
	if err := reads.Read(ctx, composition.Read{CompositionID: draft.ID, Role: composition.RolePatch}); err != nil {
		t.Fatal(err)
	}
	current := f.stored(t, draft.ID)
	if current.Patch.Name != nextPatch || current.Patch.State != composition.InputReading || current.Plan != nil {
		t.Fatalf("the patch chosen in the meantime is still waiting to be read: %+v", current.Patch)
	}
	if f.stage.Has(compositiontest.StageRoot + "/1/inputs/patch/" + patchName) {
		t.Fatal("the replaced patch is removed")
	}
	if err := f.reads.Read(ctx, composition.Read{CompositionID: 999, Role: composition.RolePatch}); err != nil {
		t.Fatalf("a composition that is gone: %v", err)
	}
	f.examiner.Err = errors.New("the scanner is restarting")
	if err := f.reads.Read(ctx, composition.Read{CompositionID: draft.ID, Role: composition.RolePatch}); err == nil {
		t.Fatal("a reading that could not be done is tried again")
	}
}

func TestANewPatchRecomposesTheResourceByItself(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	done := f.composed(t)
	rebuilt := f.rebuild(t, done)
	if !rebuilt.Rebuild() || *rebuilt.TargetFileID != composedFile || *rebuilt.ResourceID != *done.ResourceID || rebuilt.State != composition.StateDraft || *rebuilt.Details.PatchVersion != "v1.2" || *rebuilt.Note != "修正第三章的错字" || !rebuilt.KeepPatch {
		t.Fatalf("the next composition of the resource: %+v", rebuilt.Composition)
	}
	if rebuilt.Placement.GameDir == nil || *rebuilt.Placement.GameDir != wrapper || rebuilt.Placement.PatchDir != nil {
		t.Fatalf("the game folder is kept, the patch folder is found anew: %+v", rebuilt.Placement)
	}
	inherited := compositiontest.StageRoot + "/2/inputs/save/" + saveName
	if !rebuilt.Save.Ready() || rebuilt.Save.Path != inherited || f.stage.Links[inherited] != stageOne+"/inputs/save/"+saveName {
		t.Fatalf("the save comes along: %+v", rebuilt.Save)
	}
	active, _ := f.service.Active(ctx, uploader)
	if len(active) != 1 || active[0].ID != rebuilt.ID {
		t.Fatalf("it shows among the uploader's work while the patch is read: %+v", active)
	}
	_, err := f.service.Edit(ctx, uploader, rebuilt.ID, composition.Changes{KeepPatch: ptr(false)})
	expectCode(t, err, composition.ErrNotDraft)

	f.pass(time.Minute)
	f.read(t, rebuilt.ID, composition.RolePatch)
	queued := f.stored(t, rebuilt.ID)
	if queued.State != composition.StateQueued || queued.Plan == nil || queued.Plan.PatchDir != composition.Root || queued.Plan.Replaces.Files != 1 || len(f.resources.Begun) != 1 {
		t.Fatalf("once the patch is read the work is queued without a new resource: %+v", queued)
	}
	if err := f.runs.Run(ctx, rebuilt.ID); err != nil {
		t.Fatal(err)
	}
	replaced := f.resources.Replaced
	if len(replaced) != 1 || len(f.resources.Published) != 1 {
		t.Fatalf("the file is replaced, not published again: %+v", replaced)
	}
	in := replaced[0]
	if in.FileID != composedFile || in.OperatorID != uploader.UserID || *in.PatchVersion != "v1.2" || *in.Reason != "修正第三章的错字" || !slices.Equal(in.Extras, []string{download.ExtraSave}) || in.Name != queued.OutputName || in.InspectionID != 902 {
		t.Fatalf("the replacement: %+v", in)
	}
	messages := f.events.Messages()
	if last := messages[len(messages)-1]; last.Title != "Messages.System.File.Compose.RebuiltTitle" {
		t.Fatalf("the uploader is told: %+v", last)
	}
	lineage, err := f.service.Lineage(ctx, stranger, *done.ResourceID)
	if err != nil || lineage.Current != nil || lineage.Latest == nil || lineage.Latest.ID != rebuilt.ID || lineage.BaseGone {
		t.Fatalf("anyone sees what the resource was last composed from: %+v %v", lineage, err)
	}
	delete(f.bases.Resources, baseID)
	if gone, err := f.service.Lineage(ctx, uploader, *done.ResourceID); err != nil || !gone.BaseGone {
		t.Fatalf("an original that is gone is told: %+v %v", gone, err)
	}
}

func TestWhenAResourceCannotBeRecomposed(t *testing.T) {
	ctx := context.Background()
	in := composition.RebuildInput{Upload: composition.Upload{SessionID: nextUpload, Name: nextPatch}, PatchVersion: ptr("v1.2")}
	t.Run("someone else's resource", func(t *testing.T) {
		f := newFixture()
		done := f.composed(t)
		_, err := f.service.Rebuild(ctx, stranger, *done.ResourceID, in)
		expectCode(t, err, download.ErrResourceNotOwner)
	})
	t.Run("a resource that was uploaded", func(t *testing.T) {
		f := newFixture()
		published := started
		f.resources.Files[77] = download.GameResource{Resource: download.Resource{ID: 77, GameID: gameID, Status: download.ResourceActive, CreatorID: uploader.UserID, PublishedAt: &published}, Files: []download.GameFile{stored(770, "uploaded.7z", 5, nil)}}
		_, err := f.service.Rebuild(ctx, uploader, 77, in)
		expectCode(t, err, composition.ErrNotComposed)
	})
	t.Run("while another patch is being applied", func(t *testing.T) {
		f := newFixture()
		done := f.composed(t)
		f.rebuild(t, done)
		f.uploads.Sessions[44] = upload.Session{ID: 44, FileName: "v1.3.zip", TotalSize: 9, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
		_, err := f.service.Rebuild(ctx, uploader, *done.ResourceID, composition.RebuildInput{Upload: composition.Upload{SessionID: 44, Name: "v1.3.zip"}})
		expectCode(t, err, composition.ErrBusy)
		if slices.Contains(f.uploads.Taken, 44) {
			t.Fatal("the upload is left alone")
		}
	})
	t.Run("an original that is gone", func(t *testing.T) {
		f := newFixture()
		done := f.composed(t)
		delete(f.bases.Resources, baseID)
		_, err := f.service.Rebuild(ctx, uploader, *done.ResourceID, in)
		expectCode(t, err, composition.ErrBaseGone)
	})
	t.Run("a patch that cannot be read", func(t *testing.T) {
		f := newFixture()
		done := f.composed(t)
		f.examiner.Findings[nextPatch] = refusedFinding(download.CheckEncrypted)
		rebuilt := f.rebuild(t, done)
		f.read(t, rebuilt.ID, composition.RolePatch)
		failed := f.stored(t, rebuilt.ID)
		if failed.State != composition.StateFailed || *failed.Failure != composition.FailurePatchUnreadable || *failed.FailureDetail != string(composition.RefusalEncrypted) {
			t.Fatalf("the composition fails with the reason: %+v", failed)
		}
		messages := f.events.Messages()
		if last := messages[len(messages)-1]; last.Title != "Messages.System.File.Compose.FailedTitle" || last.Meta["reason"] != "COMPOSE_PATCH_UNREADABLE" {
			t.Fatalf("the uploader is told: %+v", last)
		}
		_, err := f.service.Retry(ctx, uploader, rebuilt.ID)
		expectCode(t, err, composition.ErrNotFailed)
		if err := f.service.Discard(ctx, uploader, rebuilt.ID); err != nil || len(f.resources.Discarded) != 0 {
			t.Fatalf("it can be discarded and the resource stays: %v", err)
		}
	})
	t.Run("a patch that changes nothing", func(t *testing.T) {
		f := newFixture()
		done := f.composed(t)
		f.examiner.Findings[nextPatch] = emptyPatch()
		rebuilt := f.rebuild(t, done)
		f.read(t, rebuilt.ID, composition.RolePatch)
		if failed := f.stored(t, rebuilt.ID); failed.State != composition.StateFailed || *failed.Failure != composition.FailureNothing {
			t.Fatalf("failed: %+v", failed)
		}
	})
}
