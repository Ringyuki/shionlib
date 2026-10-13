package scan_test

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func published(id, resourceID int, name string) scan.PendingFile {
	return scan.PendingFile{
		ID: id, ResourceID: resourceID, GameID: 7, Type: download.FileTypeObjectStore, Status: download.FileInObjectStore, CheckStatus: download.CheckOK,
		Name: name, Size: 1024, Hash: "sha", HashAlgorithm: "sha256", StorageKey: "games/7/" + name, CreatorID: 9, Created: now,
	}
}

func (f *fixture) next(skip []int) (scan.Backfilled, bool, error) {
	resourceID, found, err := f.backfill.Pick(context.Background(), skip)
	if err != nil || !found {
		return scan.Backfilled{}, found, err
	}
	done, err := f.backfill.Inspect(context.Background(), resourceID)
	return done, true, err
}

func fetched(id int) string {
	return work + "/stored/" + string(rune('0'+id))
}

func TestBackfillInspectsTheMostDownloadedResourceFirst(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "quiet.7z"))
	f.repo.SeedFile(published(2, 20, "popular.7z"))
	f.repo.Downloads[20] = 571
	f.tool.Listings[fetched(2)] = listing("7z", "", file("Game/game.exe", 400), file("Game/readme.txt", 16))
	f.tool.Contents[fetched(2)] = []string{"Game/game.exe", "Game/readme.txt"}
	done, found, err := f.next(nil)
	if err != nil || !found {
		t.Fatalf("next: %+v %v %v", done, found, err)
	}
	if done.ResourceID != 20 || len(done.Units) != 1 || done.Units[0].Outcome != scan.BackfillInspected || !slices.Equal(done.Units[0].Files, []string{"popular.7z"}) {
		t.Fatalf("unexpected result %+v", done)
	}
	if !slices.Equal(f.objects.Fetched, []string{"games/7/popular.7z -> " + fetched(2)}) {
		t.Fatalf("unexpected downloads %v", f.objects.Fetched)
	}
	draft := f.inspections.Drafts[0]
	if draft.ResourceID != 20 || draft.Status != inspection.StatusReady || draft.Scan.Scanned != 1 || draft.Scan.Engine != "ClamAV 1.4.3" {
		t.Fatalf("unexpected draft %+v", draft)
	}
	inspected, _ := f.repo.File(2)
	if inspected.InspectionID == nil || inspected.Status != download.FileInObjectStore || inspected.CheckStatus != download.CheckOK || f.repo.Digests[2] != digestOf(fetched(2)) {
		t.Fatalf("the file stays published and gains its record: %+v", inspected)
	}
	if len(f.inspections.Previews) != 1 || len(f.events.Jobs()) != 0 || len(f.events.Messages()) != 0 || len(f.events.Activities()) != 0 {
		t.Fatalf("a clean backfill keeps previews and tells nobody: %+v %+v", f.inspections.Previews, f.events.Jobs())
	}
	if !slices.Equal(f.workspace.Discarded, []string{work}) {
		t.Fatalf("the workspace is discarded: %v", f.workspace.Discarded)
	}

	second, found, err := f.next(nil)
	if err != nil || !found || second.ResourceID != 10 {
		t.Fatalf("the next run takes the next resource: %+v %v %v", second, found, err)
	}
	if _, found, err := f.next(nil); err != nil || found {
		t.Fatalf("nothing is left: %v %v", found, err)
	}
}

func TestBackfillPicksResourcesApartFromInspectingThem(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "quiet.7z"))
	f.repo.SeedFile(published(2, 20, "popular.7z"))
	f.repo.Downloads[20] = 571
	ctx := context.Background()
	first, found, err := f.backfill.Pick(ctx, nil)
	if err != nil || !found || first != 20 {
		t.Fatalf("the most downloaded resource comes first: %d %v %v", first, found, err)
	}
	second, found, err := f.backfill.Pick(ctx, []int{first})
	if err != nil || !found || second != 10 {
		t.Fatalf("a resource another worker took is left out: %d %v %v", second, found, err)
	}
	if len(f.objects.Fetched) != 0 {
		t.Fatalf("picking fetches nothing: %v", f.objects.Fetched)
	}
	done, err := f.backfill.Inspect(ctx, second)
	if err != nil || done.ResourceID != 10 || len(done.Units) != 1 {
		t.Fatalf("the picked resource is inspected: %+v %v", done, err)
	}
}

func TestBackfillTellsTheResourceAboutADiscImageItFinds(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "disc.7z"))
	f.tool.Listings[fetched(1)] = listing("7z", "Method = 04F71101\nSolid = +\n", file("disc.iso", 5000), file("disc.mds", 90))
	f.tool.Tests[fetched(1)] = scan.ToolRun{Failed: true, ExitCode: 2, Stderr: "ERROR: Unsupported Method : disc.iso"}
	f.tool.Extracts = map[string]scan.ToolRun{fetched(1): {Failed: true, ExitCode: 2, Stderr: "ERROR: Unsupported Method : disc.iso"}}
	done, found, err := f.next(nil)
	if err != nil || !found || done.Units[0].Outcome != scan.BackfillInspected {
		t.Fatalf("next: %+v %v %v", done, found, err)
	}
	if inspected, _ := f.repo.File(1); inspected.InspectionID == nil || !slices.Equal(f.repo.Forms, []scantest.ReadForm{{ResourceID: 10, Form: download.FormDisc}}) {
		t.Fatalf("the resource is told once the record is attached: %+v %v", inspected, f.repo.Forms)
	}
}

func TestBackfillLeavesOutWhatItWasToldToSkipAndWhatIsNotPublished(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "a.7z"))
	f.repo.SeedFile(pending(2, "/spool/2.part"))
	held := published(3, 30, "held.7z")
	held.CheckStatus = download.CheckHarmfulPendingReview
	f.repo.SeedFile(held)
	known := published(4, 40, "known.7z")
	record := 5
	known.InspectionID = &record
	f.repo.SeedFile(known)
	if _, found, err := f.next([]int{10}); err != nil || found {
		t.Fatalf("only published files that were never inspected are taken: %v %v", found, err)
	}
}

func TestBackfillChecksEveryVolumeOfASetTogether(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "game.part1.rar"))
	f.repo.SeedFile(published(2, 10, "game.part2.rar"))
	first := work + "/volumes/game.part1.rar"
	f.tool.Listings[first] = listing("Rar5", "Multivolume = +\nVolumes = 2\n", file("setup.exe", 5))
	done, _, err := f.next(nil)
	if err != nil || len(done.Units) != 1 || !slices.Equal(done.Units[0].Files, []string{"game.part1.rar", "game.part2.rar"}) {
		t.Fatalf("next: %+v %v", done, err)
	}
	if f.workspace.Links[first] != fetched(1) || f.workspace.Links[work+"/volumes/game.part2.rar"] != fetched(2) {
		t.Fatalf("the fetched volumes are linked under their names: %v", f.workspace.Links)
	}
	for _, id := range []int{1, 2} {
		if got, _ := f.repo.File(id); got.InspectionID == nil || *got.InspectionID != 1 {
			t.Fatalf("volume %d: %+v", id, got)
		}
	}
}

func TestBackfillRecordsAFileItCannotReadSoThatItIsNotTriedAgain(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "broken.7z"))
	f.tool.Listings[fetched(1)] = scan.ToolRun{Failed: true, Stdout: "Headers Error"}
	done, found, err := f.next(nil)
	if err != nil || !found || done.Units[0].Outcome != scan.BackfillUnreadable {
		t.Fatalf("next: %+v %v %v", done, found, err)
	}
	if draft := f.inspections.Drafts[0]; draft.ResourceID != 10 || draft.Status != inspection.StatusFailed || len(draft.Entries) != 0 {
		t.Fatalf("unexpected draft %+v", draft)
	}
	broken, _ := f.repo.File(1)
	if broken.InspectionID == nil || broken.CheckStatus != download.CheckOK || broken.Status != download.FileInObjectStore || f.repo.Digests[1] != digestOf(fetched(1)) {
		t.Fatalf("the file stays published with a record of the failure: %+v", broken)
	}
	if _, found, _ := f.next(nil); found {
		t.Fatal("it is not taken again")
	}
}

func TestBackfillWritesNothingAboutAnObjectTheBucketDoesNotHold(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "gone.7z"))
	f.objects.Missing["games/7/gone.7z"] = true
	done, found, err := f.next(nil)
	if err != nil || !found || done.ResourceID != 10 || done.Units[0].Outcome != scan.BackfillMissing {
		t.Fatalf("next: %+v %v %v", done, found, err)
	}
	gone, _ := f.repo.File(1)
	if gone.InspectionID != nil || len(f.inspections.Drafts) != 0 {
		t.Fatalf("a run against the wrong bucket must leave no trace: %+v %+v", gone, f.inspections.Drafts)
	}
	if _, found, _ := f.next(nil); found {
		t.Fatal("a missing object is not fetched again at once")
	}
	*f.clock = f.clock.Add(25 * time.Hour)
	if again, found, _ := f.next(nil); !found || again.ResourceID != 10 {
		t.Fatal("the file is still waiting a day later")
	}
	*f.clock = f.clock.Add(25 * time.Hour)
	if _, found, _ := f.next([]int{10}); found {
		t.Fatal("a run leaves out what it has already seen")
	}
}

func TestBackfillHoldsAPublishedFileInWhichSomethingIsDetected(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "patch.zip"))
	f.repo.Admins = []scan.Admin{{ID: 50, Email: "a@example.com"}}
	f.tool.Listings[fetched(1)] = listing("zip", "", file("patch.exe", 5))
	f.tool.Contents[fetched(1)] = []string{"patch.exe"}
	f.scanner.Reports["patch.exe"] = scan.Report{Infected: true, Viruses: []string{"Win.Trojan.Agent"}}
	done, _, err := f.next(nil)
	if err != nil || done.Units[0].Outcome != scan.BackfillHeld {
		t.Fatalf("next: %+v %v", done, err)
	}
	heldFile, _ := f.repo.File(1)
	if heldFile.CheckStatus != download.CheckHarmfulPendingReview || heldFile.Status != download.FileInObjectStore || heldFile.InspectionID == nil {
		t.Fatalf("unexpected file %+v", heldFile)
	}
	if scanCase := f.repo.Case(1); scanCase.Status != scan.CasePending || !slices.Equal(scanCase.Viruses, []string{"Win.Trojan.Agent (patch.exe)"}) {
		t.Fatalf("unexpected case %+v", scanCase)
	}
	if messages := f.events.Messages(); len(messages) != 2 || messages[0].ReceiverID != 9 || messages[1].ReceiverID != 50 {
		t.Fatalf("the uploader and the admins are told: %+v", messages)
	}
	if recorded := f.events.Activities(); len(recorded) != 1 || *recorded[0].FileStatus != download.FileInObjectStore {
		t.Fatalf("unexpected activity %+v", recorded)
	}

	if _, err := f.service.Review(context.Background(), reviewer, 1, scan.ReviewInput{Decision: scan.DecisionAllow}); err != nil {
		t.Fatal(err)
	}
	released, _ := f.repo.File(1)
	if released.CheckStatus != download.CheckOK || len(f.events.Jobs()) != 0 || !slices.Equal(f.inspections.ClearedIDs, []int{1}) {
		t.Fatalf("a published file is released without being stored again: %+v %+v %v", released, f.events.Jobs(), f.inspections.ClearedIDs)
	}
}

func TestBackfillStopsBeforeFetchingWhatTheSpoolCannotHold(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "large.7z"))
	f.room.Room = 1000
	done, found, err := f.next(nil)
	if err == nil || !found || done.ResourceID != 10 || len(f.objects.Fetched) != 0 {
		t.Fatalf("next: %+v %v %v %v", done, found, err, f.objects.Fetched)
	}
	if waiting, _ := f.repo.File(1); waiting.InspectionID != nil {
		t.Fatalf("nothing is recorded: %+v", waiting)
	}
}

func TestBackfillReportsAStoreThatFails(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(published(1, 10, "game.7z"))
	down := errors.New("bucket unavailable")
	f.objects.Err = down
	if done, found, err := f.next(nil); !errors.Is(err, down) || !found || done.ResourceID != 10 {
		t.Fatalf("next: %+v %v %v", done, found, err)
	}
	if len(f.inspections.Drafts) != 0 || !slices.Equal(f.workspace.Discarded, []string{work}) {
		t.Fatalf("nothing is recorded and the workspace is discarded: %+v %v", f.inspections.Drafts, f.workspace.Discarded)
	}
	if retry := f.repo.InspectAt[10]; !retry.Equal(f.clock.Add(time.Hour)) {
		t.Fatalf("a failed resource waits an hour before it is tried again: %v", retry)
	}
}

func TestAnOverdueCaseOfAPublishedFileWaitsForAPerson(t *testing.T) {
	f := newFixture(true)
	stored := published(1, 10, "patch.zip")
	stored.CheckStatus = download.CheckHarmfulPendingReview
	f.repo.SeedFile(stored)
	uploading := pending(2, "/spool/2.part")
	uploading.CheckStatus = download.CheckHarmfulPendingReview
	f.repo.SeedFile(uploading)
	storedID, uploadingID, storedResource, uploadingResource, gameID := 1, 2, 10, 20, 7
	overdue := now.Add(-time.Hour)
	kept := f.repo.SeedCase(scan.Case{FileID: &storedID, ResourceID: &storedResource, GameID: &gameID, UploaderID: 9, ReviewDeadline: overdue})
	removed := f.repo.SeedCase(scan.Case{FileID: &uploadingID, ResourceID: &uploadingResource, GameID: &gameID, UploaderID: 9, ReviewDeadline: overdue})
	if err := f.service.ExpireOverdue(context.Background()); err != nil {
		t.Fatal(err)
	}
	if f.repo.Case(kept.ID).Status != scan.CasePending || f.repo.Case(removed.ID).Status != scan.CaseDeleted {
		t.Fatalf("only the upload that was never published is removed: %+v %+v", f.repo.Case(kept.ID), f.repo.Case(removed.ID))
	}
	if !slices.Equal(f.repo.TakenDown, []int{uploadingResource}) {
		t.Fatalf("taken down %v", f.repo.TakenDown)
	}
}

func TestBackfillRunGoesThroughEverythingWaitingAndNamesMissingObjects(t *testing.T) {
	f := newFixture(true)
	settingtest.Set(f.settings, scan.BackfillWorkers, 1)
	f.repo.SeedFile(published(1, 10, "quiet.7z"))
	f.repo.SeedFile(published(2, 20, "popular.7z"))
	f.repo.SeedFile(published(3, 30, "gone.7z"))
	f.repo.Downloads[20] = 571
	f.objects.Missing["games/7/gone.7z"] = true
	for _, path := range []string{"/work/scan-1/stored/2", "/work/scan-2/stored/1"} {
		f.tool.Listings[path] = listing("7z", "", file("Game/game.exe", 400), file("Game/data.xp3", 4000))
		f.tool.Contents[path] = []string{"Game/game.exe", "Game/data.xp3"}
	}
	err := f.backfill.Run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "no object for files of 1 resources, among them [30]") {
		t.Fatalf("a run names the resources whose objects are missing: %v", err)
	}
	if !slices.Equal(f.objects.Fetched, []string{"games/7/popular.7z -> /work/scan-1/stored/2", "games/7/quiet.7z -> /work/scan-2/stored/1"}) {
		t.Fatalf("the most downloaded resource is fetched first: %v", f.objects.Fetched)
	}
	for _, id := range []int{1, 2} {
		if inspected, _ := f.repo.File(id); inspected.InspectionID == nil {
			t.Fatalf("file %d is inspected", id)
		}
	}
	if !slices.Equal(f.repo.Forms, []scantest.ReadForm{{ResourceID: 20, Form: download.FormPortable}, {ResourceID: 10, Form: download.FormPortable}}) {
		t.Fatalf("each resource learns its form: %v", f.repo.Forms)
	}
	if retry := f.repo.InspectAt[30]; !retry.Equal(f.clock.Add(24 * time.Hour)) {
		t.Fatalf("a missing object is looked for again a day later: %v", retry)
	}
	if err := f.backfill.Run(context.Background()); err != nil || len(f.objects.Fetched) != 2 {
		t.Fatalf("the next run finds nothing to do: %v %v", err, f.objects.Fetched)
	}
}

func TestBackfillRunTakesNothingWhileItHasNoWorkers(t *testing.T) {
	f := newFixture(true)
	settingtest.Set(f.settings, scan.BackfillWorkers, 0)
	f.repo.SeedFile(published(1, 10, "game.7z"))
	if err := f.backfill.Run(context.Background()); err != nil || len(f.objects.Fetched) != 0 {
		t.Fatalf("no workers means a pause: %v %v", err, f.objects.Fetched)
	}
}

func TestBackfillRunWaitsForChecksToBeEnabled(t *testing.T) {
	f := newFixture(false)
	f.repo.SeedFile(published(1, 10, "game.7z"))
	if err := f.backfill.Run(context.Background()); err != nil || len(f.objects.Fetched) != 0 {
		t.Fatalf("without checks nothing is fetched: %v %v", err, f.objects.Fetched)
	}
}

func TestBackfillRunTakesNoResourceCloseToItsDeadline(t *testing.T) {
	f := newFixture(true)
	*f.clock = time.Now()
	f.repo.SeedFile(published(1, 10, "game.7z"))
	ctx, cancel := context.WithDeadline(context.Background(), f.clock.Add(10*time.Minute))
	defer cancel()
	if err := f.backfill.Run(ctx); err != nil || len(f.objects.Fetched) != 0 {
		t.Fatalf("a run near its end leaves the rest to the next: %v %v", err, f.objects.Fetched)
	}
}
