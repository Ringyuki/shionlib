package scan_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func stalledFile(id int, path string, at time.Time) scan.PendingFile {
	file := pending(id, path)
	file.CheckStatus = download.CheckStalled
	file.CheckFailures = 6
	file.StalledAt = &at
	return file
}

func TestAStalledCheckIsResumedOnRequest(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	f.repo.SeedFile(stalledFile(1, "/spool/1.part", now.Add(-time.Hour)))
	f.repo.SeedFile(stalledFile(2, "/spool/2.part", now.Add(-time.Hour)))
	f.repo.SeedFile(pending(3, "/spool/3.part"))
	for _, path := range []string{"/spool/1.part", "/spool/2.part", "/spool/3.part"} {
		f.tool.Listings[path] = listing("7z", "", file("game.exe", 4))
	}
	if err := f.repo.DelayCheck(ctx, 10, now.Add(8*time.Hour)); err != nil {
		t.Fatal(err)
	}
	resumed, err := f.stalled.Resume(ctx, []int{1, 3})
	if err != nil || len(resumed) != 1 || resumed[0].ResourceID != 10 || !slices.Equal(resumed[0].Files, []string{"file.7z"}) {
		t.Fatalf("only the stalled files that were asked for are resumed: %+v %v", resumed, err)
	}
	first, _ := f.repo.File(1)
	if first.CheckStatus != download.CheckPending || first.CheckFailures != 0 || first.StalledAt != nil || f.repo.CheckError(1) != "" || f.repo.RetryAt(10).After(now) {
		t.Fatalf("a resumed check starts over at once: %+v, next try at %s", first, f.repo.RetryAt(10))
	}
	if other, _ := f.repo.File(2); other.CheckStatus != download.CheckStalled {
		t.Fatalf("the other file still waits: %+v", other)
	}
	if err := f.service.ScanPending(ctx); err != nil {
		t.Fatal(err)
	}
	if checked, _ := f.repo.File(1); checked.CheckStatus != download.CheckOK {
		t.Fatalf("the resumed file is checked by the next run: %+v", checked)
	}
	everything, err := f.stalled.Resume(ctx, nil)
	if err != nil || len(everything) != 1 || everything[0].ResourceID != 20 {
		t.Fatalf("without ids every stalled check is resumed: %+v %v", everything, err)
	}
}

func TestAStalledCheckNobodyHandledIsAbandonedAtItsDeadline(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	f.repo.SeedFile(stalledFile(1, "/spool/1.part", now.Add(-8*24*time.Hour)))
	f.repo.SeedFile(stalledFile(2, "/spool/2.part", now.Add(-6*24*time.Hour)))
	if err := f.stalled.Abandon(ctx); err != nil {
		t.Fatal(err)
	}
	gone, _ := f.repo.File(1)
	if gone.CheckStatus != download.CheckAbandoned || !gone.CheckStatus.Rejected() {
		t.Fatalf("a check that waited past its deadline is given up: %+v", gone)
	}
	if waiting, _ := f.repo.File(2); waiting.CheckStatus != download.CheckStalled {
		t.Fatalf("a check within its deadline still waits: %+v", waiting)
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].ReceiverID != 9 || messages[0].Title != "Messages.System.File.Upload.FileUploadFailedTitle" {
		t.Fatalf("the uploader is told once: %+v", messages)
	}
	if told := decodeMeta(t, messages[0]); told["reason"] != "ABANDONED" || told["file_check_status"] != float64(download.CheckAbandoned) {
		t.Fatalf("unexpected message %+v", told)
	}
	if err := f.stalled.Abandon(ctx); err != nil || len(f.events.Messages()) != 1 {
		t.Fatalf("an abandoned check is left to the cleanup: %v", err)
	}
}

func TestStalledChecksAreListedWithTheirDeadline(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	at := now.Add(-3 * 24 * time.Hour)
	f.repo.SeedFile(stalledFile(1, "/spool/1.part", at))
	f.repo.SeedFile(pending(2, "/spool/2.part"))
	f.repo.Names[9] = "uploader"
	f.repo.Titles[7] = scan.GameTitles{ID: 7, TitleJP: "ゲーム"}
	if err := f.repo.RecordCheckFailure(ctx, 1, scan.CheckFailure{Failures: 6, Reason: "clamd is down", StalledAt: &at}); err != nil {
		t.Fatal(err)
	}
	entries, err := f.stalled.List(ctx)
	if err != nil || len(entries) != 1 {
		t.Fatalf("only stalled checks are listed: %+v %v", entries, err)
	}
	entry := entries[0]
	if entry.File.ID != 1 || entry.Reason != "clamd is down" || entry.Uploader.Name != "uploader" || entry.Game.TitleJP != "ゲーム" {
		t.Fatalf("unexpected entry %+v", entry)
	}
	if !entry.Deadline.Equal(at.Add(7 * 24 * time.Hour)) {
		t.Fatalf("the deadline is the kept time after the check stalled: %s", entry.Deadline)
	}
}

func TestAnAdminRechecksOrRemovesOneStalledFile(t *testing.T) {
	f := newFixture(true)
	ctx := context.Background()
	f.repo.SeedFile(stalledFile(1, "/spool/1.part", now.Add(-time.Hour)))
	f.repo.SeedFile(stalledFile(2, "/spool/2.part", now.Add(-time.Hour)))
	f.repo.SeedFile(pending(3, "/spool/3.part"))

	if err := f.stalled.Recheck(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if again, _ := f.repo.File(1); again.CheckStatus != download.CheckPending || again.CheckFailures != 0 {
		t.Fatalf("the file is checked again from the start: %+v", again)
	}
	if err := f.stalled.Recheck(ctx, 1); !errors.Is(err, scan.ErrCheckNotStalled) {
		t.Fatalf("a file that no longer waits cannot be rechecked: %v", err)
	}
	if err := f.stalled.Recheck(ctx, 3); !errors.Is(err, scan.ErrCheckNotStalled) {
		t.Fatalf("a file whose check never stalled cannot be rechecked: %v", err)
	}

	if err := f.stalled.Remove(ctx, 2); err != nil {
		t.Fatal(err)
	}
	gone, _ := f.repo.File(2)
	if gone.CheckStatus != download.CheckAbandoned {
		t.Fatalf("a removed file is given up: %+v", gone)
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].ReceiverID != 9 || decodeMeta(t, messages[0])["reason"] != "ABANDONED" {
		t.Fatalf("the uploader is told: %+v", messages)
	}
	if err := f.stalled.Remove(ctx, 2); !errors.Is(err, scan.ErrCheckNotStalled) {
		t.Fatalf("a file that was removed cannot be removed again: %v", err)
	}
	if err := f.stalled.Remove(ctx, 404); !errors.Is(err, scan.ErrCheckNotStalled) {
		t.Fatalf("unexpected result for an unknown file: %v", err)
	}
}
