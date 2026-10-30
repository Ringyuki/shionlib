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
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

const stageOne = compositiontest.StageRoot + "/1"

func (f *fixture) withSave(t *testing.T) composition.View {
	t.Helper()
	ctx := context.Background()
	draft := f.described(t)
	if _, err := f.service.Attach(ctx, uploader, draft.ID, composition.RoleSave, composition.Upload{SessionID: saveUpload, Name: saveName}); err != nil {
		t.Fatal(err)
	}
	f.read(t, draft.ID, composition.RoleSave)
	view, err := f.service.Start(ctx, uploader, draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func stepsOf(done composition.Composition) []composition.Step {
	steps := make([]composition.Step, len(done.Runs))
	for i, run := range done.Runs {
		steps[i] = run.Step
	}
	return steps
}

func TestAQueuedCompositionIsFetchedUnpackedPatchedPackedCheckedAndPublished(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	queued := f.withSave(t)
	if err := f.runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	done := f.stored(t, queued.ID)
	if done.State != composition.StateDone || done.FinishedAt == nil || done.Failure != nil || done.Step != nil || !slices.Equal(stepsOf(done), composition.Steps) {
		t.Fatalf("a finished composition went through every step: %+v", done)
	}
	for _, run := range done.Runs {
		if run.Finished == nil {
			t.Fatalf("step %s is closed", run.Step)
		}
	}
	if !slices.Equal(f.objects.Fetched, []string{baseKey}) {
		t.Fatalf("the original is fetched: %v", f.objects.Fetched)
	}
	work := stageOne + "/work"
	wantUnpacked := []composition.Unpacking{
		{Archive: work + "/base/" + baseName, Destination: work + "/tree/game", Threads: 4},
		{Archive: stageOne + "/inputs/patch/" + patchName, Destination: work + "/tree/patch", Threads: 4},
		{Archive: stageOne + "/inputs/save/" + saveName, Destination: work + "/out/" + composition.SaveFolder, Threads: 4},
	}
	if !slices.Equal(f.archiver.Unpacked, wantUnpacked) {
		t.Fatalf("what was unpacked where: %+v", f.archiver.Unpacked)
	}
	if !slices.Equal(f.stage.Swept, []string{work + "/tree/game", work + "/tree/patch", work + "/out/" + composition.SaveFolder}) {
		t.Fatalf("everything unpacked is swept: %v", f.stage.Swept)
	}
	packed := f.archiver.Packed
	if len(packed) != 1 || packed[0].Root != work+"/out" || !slices.Equal(packed[0].Entries, []string{wrapper, composition.SaveFolder, composition.PatchFolder}) || packed[0].Target != work+"/"+queued.OutputName {
		t.Fatalf("what was packed: %+v", packed)
	}
	published := f.resources.Published
	if len(published) != 1 {
		t.Fatalf("published: %+v", published)
	}
	file := published[0]
	wantSize := int64(900 + 146 + 5000 + 3 + 942 + 828 + 3 + 64 + 850)
	if file.ResourceID != *queued.ResourceID || file.Name != queued.OutputName || file.LocalPath != packed[0].Target || file.Size != wantSize || file.SHA256 != "sha-"+queued.OutputName || file.InspectionID != 901 {
		t.Fatalf("the file handed over: %+v", file)
	}
	wantChanges := []download.FieldChange{
		{Field: download.FieldBase, Old: []string{}, New: []string{baseName}},
		{Field: download.FieldPatchVersion, Old: []string{}, New: []string{"v1.1"}},
		{Field: download.FieldExtras, Old: []string{}, New: []string{download.ExtraSave}},
	}
	if !slices.EqualFunc(file.Changes, wantChanges, func(a, b download.FieldChange) bool { return a.Field == b.Field && slices.Equal(a.New, b.New) }) {
		t.Fatalf("how the resource came to be: %+v", file.Changes)
	}
	if examined := f.examiner.Examined[len(f.examiner.Examined)-1]; examined.ResourceID != *queued.ResourceID || examined.Path != packed[0].Target || !slices.Equal(f.examiner.Recorded, []string{packed[0].Target}) {
		t.Fatalf("the result is checked and its contents recorded: %+v", examined)
	}
	if *done.OutputSize != wantSize {
		t.Fatalf("the size of the result: %d", *done.OutputSize)
	}
	if f.stage.Has(work) || f.stage.Has(stageOne+"/inputs/patch") || !f.stage.Has(stageOne+"/inputs/save/"+saveName) {
		t.Fatal("afterwards only the save is kept, for the next patch")
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].Title != "Messages.System.File.Compose.DoneTitle" || messages[0].Tone != message.ToneSuccess || messages[0].ReceiverID != uploader.UserID || *messages[0].LinkURL != "/resource/501" || messages[0].Meta["file_name"] != queued.OutputName {
		t.Fatalf("the uploader is told: %+v", messages)
	}
	if err := f.runs.Run(ctx, queued.ID); err != nil || len(f.resources.Published) != 1 {
		t.Fatalf("a finished composition is not run again: %v", err)
	}
}

func TestPatchFilesLandWhereTheGameKeepsThem(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	queued := f.queued(t)
	f.archiver.Err = nil
	hold := &holdingArchiver{Archiver: f.archiver, stage: f.stage}
	runs := f.runsWith(hold)
	if err := runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	want := []string{
		composition.PatchFolder + "/" + patchName,
		wrapper + "/LimelightLemonadeJam.exe",
		wrapper + "/LimelightLemonadeJam_chs.exe",
		wrapper + "/data.xp3",
		wrapper + "/patch.xp3",
		wrapper + "/patch_chs.xp3",
		wrapper + "/savedata/readme.txt",
		wrapper + "/汉化说明.txt",
	}
	slices.Sort(want)
	if !slices.Equal(hold.packed, want) {
		t.Fatalf("the folder that is packed: %v", hold.packed)
	}
	if hold.sizes[wrapper+"/patch.xp3"] != 146 {
		t.Fatalf("the patch's file replaces the game's under the game's own name: %d", hold.sizes[wrapper+"/patch.xp3"])
	}
	if f.stage.Has(stageOne) {
		t.Fatal("without a save nothing is kept")
	}
}

func TestWhatStopsACompositionAndHowItIsToldApart(t *testing.T) {
	ctx := context.Background()
	cases := map[composition.Failure]func(f *fixture){
		composition.FailureBaseGone:        func(f *fixture) { delete(f.bases.Resources, baseID) },
		composition.FailureBaseUnreadable:  func(f *fixture) { f.archiver.Unreadable[baseName] = true },
		composition.FailurePatchUnreadable: func(f *fixture) { f.archiver.Unreadable[patchName] = true },
		composition.FailureNoRoom:          func(f *fixture) { f.spool.Room = 100 },
		composition.FailureTooLarge:        func(f *fixture) { f.settings[composition.MaxUnpackedSize.Name()] = int64(1 << 30); f.grow() },
		composition.FailurePlaceMissing: func(f *fixture) {
			f.archiver.Contents[patchName] = []composition.Node{{Path: "elsewhere/a.bin", Size: 1}}
		},
		composition.FailureNothing: func(f *fixture) {
			f.archiver.Contents[patchName] = []composition.Node{{Path: "汉化补丁 v1.1", Dir: true}}
		},
		composition.FailureHarmful: func(f *fixture) { f.harmfulResult = true },
		composition.FailureBroken:  func(f *fixture) { f.brokenResult = true },
	}
	for reason, arrange := range cases {
		f := newFixture()
		queued := f.queued(t)
		arrange(f)
		f.arrangeResult(queued.OutputName)
		if err := f.runs.Run(ctx, queued.ID); err != nil {
			t.Fatalf("%s: a composition that cannot go on is not an error of the worker: %v", reason, err)
		}
		failed := f.stored(t, queued.ID)
		if failed.State != composition.StateFailed || failed.Failure == nil || *failed.Failure != reason || failed.FinishedAt == nil {
			t.Fatalf("%s: %+v", reason, failed)
		}
		if f.stage.Has(stageOne+"/work") || !f.stage.Has(stageOne+"/inputs/patch/"+patchName) {
			t.Fatalf("%s: the work is cleared and the patch is kept for another try", reason)
		}
		messages := f.events.Messages()
		if len(messages) != 1 || messages[0].Title != "Messages.System.File.Compose.FailedTitle" || messages[0].Tone != message.ToneDestructive || len(f.resources.Published) != 0 {
			t.Fatalf("%s: the uploader is told and nothing is published: %+v", reason, messages)
		}
		if reason == composition.FailureHarmful && (failed.FailureDetail == nil || *failed.FailureDetail != "Eicar (ライムライト/chs.exe)") {
			t.Fatalf("what was found: %v", failed.FailureDetail)
		}
	}
}

func TestAFailedCompositionCanBeTriedAgain(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	queued := f.queued(t)
	f.archiver.Unreadable[baseName] = true
	if err := f.runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	_, err := f.service.Retry(ctx, stranger, queued.ID)
	expectCode(t, err, composition.ErrNotOwner)
	delete(f.archiver.Unreadable, baseName)
	retried, err := f.service.Retry(ctx, uploader, queued.ID)
	if err != nil || retried.State != composition.StateQueued || retried.Failure != nil || len(retried.Runs) != 0 {
		t.Fatalf("queued again: %+v %v", retried.Composition, err)
	}
	_, err = f.service.Retry(ctx, uploader, queued.ID)
	expectCode(t, err, composition.ErrNotFailed)
	if err := f.runs.Run(ctx, queued.ID); err != nil || f.stored(t, queued.ID).State != composition.StateDone || len(f.resources.Published) != 1 {
		t.Fatalf("the second run finishes: %v", err)
	}
}

func TestOnlySoManyCompositionsRunAtOnce(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	first := f.queued(t)
	running := f.stored(t, first.ID)
	running.State = composition.StateRunning
	if err := f.repo.Save(ctx, running); err != nil {
		t.Fatal(err)
	}
	f.uploads.Sessions[patchUpload] = f.uploads.Sessions[saveUpload]
	second := f.queuedWith(t, saveUpload)
	if err := f.runs.Run(ctx, second.ID); !errors.Is(err, composition.ErrNoSlot) || f.stored(t, second.ID).State != composition.StateQueued {
		t.Fatalf("the second waits for a free slot: %v", err)
	}
	f.settings[composition.Concurrency.Name()] = 2
	if err := f.runs.Run(ctx, second.ID); err != nil || f.stored(t, second.ID).State != composition.StateDone {
		t.Fatalf("with two slots it runs: %v", err)
	}
}

func TestATroubleOfTheMachineIsRetriedAndGivenUpInTheEnd(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	queued := f.queued(t)
	outage := errors.New("object storage is unreachable")
	f.objects.Err = outage
	if err := f.runs.Run(ctx, queued.ID); !errors.Is(err, outage) {
		t.Fatalf("the worker gets the error to try again: %v", err)
	}
	if during := f.stored(t, queued.ID); during.State != composition.StateRunning || len(f.events.Messages()) != 0 {
		t.Fatalf("until then the composition counts as running: %+v", during)
	}
	f.objects.Err = nil
	if err := f.runs.Run(ctx, queued.ID); err != nil || f.stored(t, queued.ID).State != composition.StateDone {
		t.Fatalf("the next attempt starts over and finishes: %v", err)
	}

	lost := newFixture()
	again := lost.queued(t)
	lost.objects.Err = outage
	_ = lost.runs.Run(ctx, again.ID)
	if err := lost.runs.GiveUp(ctx, again.ID, outage); err != nil {
		t.Fatal(err)
	}
	given := lost.stored(t, again.ID)
	if given.State != composition.StateFailed || *given.Failure != composition.FailureInternal || *given.FailureDetail != outage.Error() || len(lost.events.Messages()) != 1 {
		t.Fatalf("given up: %+v", given)
	}
	if err := lost.runs.GiveUp(ctx, again.ID, outage); err != nil || len(lost.events.Messages()) != 1 {
		t.Fatalf("giving up twice tells once: %v", err)
	}
	if err := lost.runs.GiveUp(ctx, 999, outage); err != nil {
		t.Fatalf("a composition that is gone: %v", err)
	}
}

func TestProgressIsKeptForWhoeverLooks(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	queued := f.queued(t)
	f.archiver.Unreadable[patchName] = true
	f.pass(10 * time.Second)
	if err := f.runs.Run(ctx, queued.ID); err != nil {
		t.Fatal(err)
	}
	view, err := f.service.Get(ctx, uploader, queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.DiscardAt != nil {
		t.Fatalf("a composition that has started is never cleared as a draft: %v", view.DiscardAt)
	}
	steps := view.Steps
	if len(steps) != len(composition.Steps) || !steps[0].Done || steps[0].Seconds == nil || !steps[1].Done || steps[2].Seconds != nil || steps[2].Done || steps[2].Running {
		t.Fatalf("the steps taken and the ones never reached: %+v", steps)
	}
}
