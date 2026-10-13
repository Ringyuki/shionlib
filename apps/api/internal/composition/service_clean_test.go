package composition_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition/compositiontest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func TestDraftsNobodyReturnsToAreClearedAway(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	abandoned := f.described(t)
	f.pass(23 * time.Hour)
	f.uploads.Sessions[patchUpload] = upload.Session{ID: patchUpload, FileName: patchName, TotalSize: 850, Status: upload.StatusCompleted, CreatorID: uploader.UserID}
	recent := f.described(t)
	queued := f.queuedWith(t, saveUpload)
	f.stage.MakeDir(compositiontest.StageRoot + "/77/work")
	f.pass(2 * time.Hour)

	if err := f.cleaner.Clean(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(ctx, abandoned.ID); err == nil || f.stage.Has(compositiontest.StageRoot+"/1") {
		t.Fatal("a draft left alone for a day is removed with its files")
	}
	if _, err := f.repo.Get(ctx, recent.ID); err != nil || !f.stage.Has(compositiontest.StageRoot+"/2/inputs/patch/"+patchName) {
		t.Fatalf("a draft touched since stays: %v", err)
	}
	if kept := f.stored(t, queued.ID); kept.State != composition.StateQueued {
		t.Fatalf("queued work is never cleared: %+v", kept)
	}
	if f.stage.Has(compositiontest.StageRoot + "/77") {
		t.Fatal("a folder no composition owns is removed")
	}
	if err := f.cleaner.Clean(ctx); err != nil {
		t.Fatalf("cleaning again: %v", err)
	}
}

func TestWorkThatLostItsJobIsQueuedAgain(t *testing.T) {
	ctx := context.Background()
	f := newFixture()
	reading := f.begin(t)
	if _, err := f.service.Attach(ctx, uploader, reading.ID, composition.RolePatch, composition.Upload{SessionID: patchUpload, Name: patchName}); err != nil {
		t.Fatal(err)
	}
	queued := f.queuedWith(t, saveUpload)
	before := len(f.events.Jobs())
	if err := f.cleaner.Clean(ctx); err != nil {
		t.Fatal(err)
	}
	jobs := f.events.Jobs()[before:]
	want := []composition.Job{composition.Read{CompositionID: reading.ID, Role: composition.RolePatch}, composition.Run{CompositionID: queued.ID}}
	if len(jobs) != 2 || jobs[0] != want[0] || jobs[1] != want[1] {
		t.Fatalf("an input still to be read and a composition still to be run get their jobs again: %+v", jobs)
	}
}
