package scan_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

var (
	now      = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	reviewer = actor.Actor{UserID: 50, Role: actor.RoleAdmin}
)

type fixture struct {
	repo      *scantest.MemoryRepository
	workspace *scantest.Workspace
	tool      *scantest.ArchiveTool
	scanner   *scantest.Scanner
	room      *scantest.Spool
	events    *downloadtest.Recorder
	banner    *scantest.Banner
	mailer    *scantest.Mailer
	service   *scan.Service
}

func newFixture(enabled bool) fixture {
	workspace := scantest.NewWorkspace()
	f := fixture{
		repo:      scantest.NewMemoryRepository(func() time.Time { return now }),
		workspace: workspace,
		tool:      &scantest.ArchiveTool{Listings: map[string]scan.ToolRun{}, Tests: map[string]scan.ToolRun{}, Contents: map[string][]string{}, Workspace: workspace},
		scanner:   &scantest.Scanner{Reports: map[string]scan.Report{}, Limit: 1 << 20},
		room:      &scantest.Spool{Room: 1 << 30},
		events:    &downloadtest.Recorder{},
		banner:    &scantest.Banner{Applied: true},
		mailer:    &scantest.Mailer{},
	}
	f.service = scan.NewService(scan.Deps{
		Repo:       f.repo,
		Archives:   f.tool,
		Scanner:    f.scanner,
		Workspace:  f.workspace,
		Spool:      f.room,
		Files:      f.repo,
		Activities: f.events,
		Messages:   f.events,
		Banner:     f.banner,
		Mailer:     f.mailer,
		Queue:      f.events,
		Tx:         &txtest.Immediate{},
		Settings:   settingtest.Set(settingtest.Source{}, scan.AutoBanThreshold, 2),
		Options:    scan.Options{Enabled: enabled, SiteURL: "https://shionlib.example/"},
		Now:        func() time.Time { return now },
	})
	return f
}

func pending(id int, path string) scan.PendingFile {
	session := 100 + id
	return scan.PendingFile{ID: id, ResourceID: id * 10, GameID: 7, Type: download.FileTypeObjectStore, Status: download.FileOnServer, Path: path, Name: "file.7z", Size: 1024, Hash: "b3", HashAlgorithm: "blake3", UploadSessionID: &session, CreatorID: 9}
}

func decodeMeta(t *testing.T, msg message.NewMessage) map[string]any {
	t.Helper()
	raw, err := json.Marshal(msg.Meta)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestInspectArchiveClassification(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		name    string
		listing scan.ToolRun
		test    scan.ToolRun
		want    download.CheckStatus
	}{
		{name: "clean archive", want: download.CheckOK},
		{name: "list wrong password", listing: scan.ToolRun{Failed: true, Stderr: "ERROR: Wrong password"}, want: download.CheckEncrypted},
		{name: "list headers error", listing: scan.ToolRun{Failed: true, Stdout: "Headers Error"}, want: download.CheckBrokenOrTruncated},
		{name: "list not an archive", listing: scan.ToolRun{Failed: true, Stderr: "Can not open file as archive"}, want: download.CheckBrokenOrTruncated},
		{name: "list other failure", listing: scan.ToolRun{Failed: true, Message: "exit status 2"}, want: download.CheckBrokenOrUnsupported},
		{name: "multivolume rar with headers error", listing: scan.ToolRun{Stdout: "Type = Rar\nMultivolume = +", Stderr: "Headers Error"}, want: download.CheckBrokenOrTruncated},
		{name: "rar5 with volume count", listing: scan.ToolRun{Stdout: "Type = Rar5\nVolumes = 3\nHeaders Error"}, want: download.CheckBrokenOrTruncated},
		{name: "single volume rar", listing: scan.ToolRun{Stdout: "Type = Rar\nVolumes = 1\nHeaders Error"}, want: download.CheckOK},
		{name: "rar volumes headers", listing: scan.ToolRun{Stdout: "Type = Rar\nVolumes = 3\nHeaders Error"}, want: download.CheckBrokenOrTruncated},
		{name: "encrypted flag", listing: scan.ToolRun{Stdout: "Encrypted = +"}, want: download.CheckEncrypted},
		{name: "aes method", listing: scan.ToolRun{Stdout: "Method = AES-256 LZMA2"}, want: download.CheckEncrypted},
		{name: "test crc failure", test: scan.ToolRun{Stdout: "CRC Failed : a.bin"}, want: download.CheckBrokenOrTruncated},
		{name: "test wrong password", test: scan.ToolRun{Failed: true, Stderr: "Can not decrypt"}, want: download.CheckEncrypted},
		{name: "test data error", test: scan.ToolRun{Failed: true, Stdout: "Data Error"}, want: download.CheckBrokenOrTruncated},
		{name: "test unsupported method", test: scan.ToolRun{Failed: true, Stderr: "Unsupported Method"}, want: download.CheckOK},
		{name: "test killed", test: scan.ToolRun{Failed: true, Killed: true}, want: download.CheckOK},
		{name: "test warnings exit", test: scan.ToolRun{Failed: true, ExitCode: 1}, want: download.CheckOK},
		{name: "test overflow", test: scan.ToolRun{Failed: true, Overflow: true, ExitCode: 2}, want: download.CheckOK},
		{name: "test fatal", test: scan.ToolRun{Failed: true, ExitCode: 2, Message: "exit status 2"}, want: download.CheckBrokenOrUnsupported},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tool := &scantest.ArchiveTool{Listings: map[string]scan.ToolRun{"f": tc.listing}, Tests: map[string]scan.ToolRun{"f": tc.test}}
			got, err := scan.InspectArchive(ctx, tool, "f")
			if err != nil || got.Status != tc.want {
				t.Fatalf("got %d %v want %d", got.Status, err, tc.want)
			}
		})
	}
}

func TestScanPendingIsDisabledByConfiguration(t *testing.T) {
	f := newFixture(false)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckPending {
		t.Fatalf("files stay pending while scanning is off: %+v", file)
	}
}

func TestScanRejectsBrokenArchives(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Listings["/spool/1.part"] = scan.ToolRun{Failed: true, Stderr: "Wrong password"}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	file, _ := f.repo.File(1)
	if file.CheckStatus != download.CheckEncrypted {
		t.Fatalf("check status %d", file.CheckStatus)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileCheckEncrypted || *recorded[0].FileCheckStatus != 4 || *recorded[0].FileStatus != 2 {
		t.Fatalf("activity %+v", recorded)
	}
	messages := f.events.Messages()
	meta := decodeMeta(t, messages[0])
	if len(messages) != 1 || messages[0].Tone != message.ToneDestructive || messages[0].Title != "Messages.System.File.Upload.FileUploadFailedTitle" || meta["reason"] != "ENCRYPTED" || meta["file_check_status"] != float64(4) || meta["file_name"] != "file.7z" {
		t.Fatalf("message %+v meta %v", messages, meta)
	}
	if len(f.events.Jobs()) != 0 || len(f.tool.Extracted) != 0 {
		t.Fatal("rejected files are neither scanned nor stored")
	}
	if !slices.Equal(f.workspace.Discarded, []string{"/work/scan-1"}) {
		t.Fatalf("the workspace is discarded: %v", f.workspace.Discarded)
	}
}

func TestScanApprovesCleanFilesAfterScanningTheirExecutables(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Contents["/spool/1.part"] = []string{"game/bin/setup.exe", "game/data.pak", "game/readme.txt", "game/extras/patch.zip"}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(f.scanner.Scanned, []string{"game/bin/setup.exe", "game/extras/patch.zip"}) {
		t.Fatalf("only executables and nested archives are scanned: %v", f.scanner.Scanned)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckOK {
		t.Fatalf("check status %d", file.CheckStatus)
	}
	jobs := f.events.Jobs()
	if len(jobs) != 1 || jobs[0] != (download.StoreFile{FileID: 1}) {
		t.Fatalf("store job %+v", jobs)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileCheckOK || len(f.events.Messages()) != 0 {
		t.Fatalf("approval activity %+v messages %+v", recorded, f.events.Messages())
	}
}

func TestStandaloneExecutablesAreScannedWhole(t *testing.T) {
	f := newFixture(true)
	file := pending(1, "/spool/1.part")
	file.Name = "Patch.EXE"
	f.repo.SeedFile(file)
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(f.scanner.Scanned, []string{"Patch.EXE"}) {
		t.Fatalf("an uploaded executable is scanned itself: %v", f.scanner.Scanned)
	}
}

func TestEntriesOverTheScannerLimitAreNeitherExtractedNorScanned(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Listings["/spool/1.part"] = scan.ToolRun{Stdout: "Path = /spool/1.part\nType = 7z\n\n----------\nPath = game/setup.exe\nSize = 10\n\nPath = game/data.cab\nSize = 2097152\n\nPath = game/movie.mp4\nSize = 2097152\n"}
	f.tool.Contents["/spool/1.part"] = []string{"game/setup.exe", "game/data.cab", "game/movie.mp4"}
	huge := pending(2, "/spool/2.part")
	huge.Name, huge.Size = "Huge.exe", 2<<20
	f.repo.SeedFile(huge)
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(f.scanner.Scanned, []string{"game/setup.exe"}) {
		t.Fatalf("files too large to scan are skipped: %v", f.scanner.Scanned)
	}
	for _, id := range []int{1, 2} {
		if file, _ := f.repo.File(id); file.CheckStatus != download.CheckOK {
			t.Fatalf("file %d is approved: %+v", id, file)
		}
	}
}

func TestChecksWaitForRoomToExtract(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Listings["/spool/1.part"] = scan.ToolRun{Stdout: "Path = /spool/1.part\nType = zip\n\n----------\nPath = setup.exe\nSize = 100\n"}
	f.tool.Contents["/spool/1.part"] = []string{"setup.exe"}
	f.room.Room = 99
	if err := f.service.ScanPending(context.Background()); err == nil {
		t.Fatal("a check without room to extract fails")
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckPending || len(f.tool.Extracted) != 0 || f.repo.RetryAt(10).IsZero() {
		t.Fatalf("nothing is extracted and the resource waits: %+v %v", file, f.tool.Extracted)
	}
}

func TestExtractionCutShortScansWhatWasExtracted(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Contents["/spool/1.part"] = []string{"setup.exe"}
	f.tool.Extracts = map[string]scan.ToolRun{"/spool/1.part": {Failed: true, Killed: true, Message: "command timeout"}}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckOK || !slices.Equal(f.scanner.Scanned, []string{"setup.exe"}) {
		t.Fatalf("a timed out extraction is handled like a timed out test: %+v %v", file, f.scanner.Scanned)
	}
}

func TestScanQuarantinesInfectedFiles(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Contents["/spool/1.part"] = []string{"bin/setup.exe", "bin/clean.dll"}
	f.repo.Admins = []scan.Admin{{ID: 50, Email: "a@example.com"}, {ID: 51}}
	f.repo.Names[9] = "uploader"
	f.repo.Titles[7] = scan.GameTitles{ID: 7, TitleJP: "ゲーム"}
	logPath := "/var/log/clamav-scan.log"
	f.scanner.Reports["bin/setup.exe"] = scan.Report{Infected: true, Viruses: []string{" Eicar ", "Trojan"}, Result: json.RawMessage(`{"file":"bin/setup.exe","isInfected":true}`), LogPath: &logPath}
	f.scanner.Reports["bin/clean.dll"] = scan.Report{Result: json.RawMessage(`{"file":"bin/clean.dll","isInfected":false}`)}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckHarmfulPendingReview {
		t.Fatalf("check status %d", file.CheckStatus)
	}
	scanCase := f.repo.Case(1)
	if scanCase.Status != scan.CasePending || !slices.Equal(scanCase.Viruses, []string{"Eicar (bin/setup.exe)", "Trojan (bin/setup.exe)"}) || !scanCase.ReviewDeadline.Equal(now.Add(24*time.Hour)) || *scanCase.ScanLogPath != logPath {
		t.Fatalf("case %+v", scanCase)
	}
	if string(scanCase.ScanResult) != `[{"file":"bin/setup.exe","isInfected":true},{"file":"bin/clean.dll","isInfected":false}]` {
		t.Fatalf("every scanned entry is kept in the result: %s", scanCase.ScanResult)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileCheckHarmful || *recorded[0].FileCheckStatus != int(download.CheckHarmful) {
		t.Fatalf("activity %+v", recorded)
	}
	messages := f.events.Messages()
	if len(messages) != 3 || messages[0].ReceiverID != 9 || messages[1].ReceiverID != 50 || messages[2].ReceiverID != 51 {
		t.Fatalf("uploader and admins are told: %+v", messages)
	}
	if meta := decodeMeta(t, messages[0]); meta["detected_viruses"] != "Eicar (bin/setup.exe), Trojan (bin/setup.exe)" || meta["review_deadline"] != "2026-10-04T12:00:00Z" {
		t.Fatalf("uploader meta %v", meta)
	}
	if *messages[1].LinkURL != "/admin/malware-scans?id=1" || decodeMeta(t, messages[1])["uploader_name"] != "uploader" {
		t.Fatalf("admin message %+v", messages[1])
	}
	if len(f.mailer.Alerts) != 1 || !slices.Equal(f.mailer.Recipients[0], []string{"a@example.com"}) || f.mailer.Alerts[0].ReviewURL != "https://shionlib.example/admin/malware-scans?id=1" || f.mailer.Alerts[0].GameTitle != "ゲーム" {
		t.Fatalf("mail %+v %+v", f.mailer.Recipients, f.mailer.Alerts)
	}
	if len(f.events.Jobs()) != 0 {
		t.Fatal("quarantined files are not stored")
	}
}

func volume(id int, name string, created time.Time) scan.PendingFile {
	file := pending(id, fmt.Sprintf("/spool/%d.part", id))
	file.ResourceID, file.Name, file.Created = 10, name, created
	return file
}

func TestVolumeSetsAreCheckedTogether(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(volume(2, "game.part2.rar", now))
	f.repo.SeedFile(volume(1, "game.part1.rar", now))
	f.tool.Contents["/work/scan-1/volumes/game.part1.rar"] = []string{"setup.exe"}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if f.workspace.Links["/work/scan-1/volumes/game.part1.rar"] != "/spool/1.part" || f.workspace.Links["/work/scan-1/volumes/game.part2.rar"] != "/spool/2.part" {
		t.Fatalf("volumes are linked under their names: %v", f.workspace.Links)
	}
	if !slices.Equal(f.tool.Inspected, []string{"/work/scan-1/volumes/game.part1.rar"}) || !slices.Equal(f.scanner.Scanned, []string{"setup.exe"}) {
		t.Fatalf("the set is opened once from its first volume: %v %v", f.tool.Inspected, f.scanner.Scanned)
	}
	if jobs := f.events.Jobs(); len(jobs) != 2 || jobs[0] != (download.StoreFile{FileID: 1}) || jobs[1] != (download.StoreFile{FileID: 2}) {
		t.Fatalf("every volume is approved: %+v", jobs)
	}
}

func TestIncompleteSetsWaitForTheirMissingVolumes(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(volume(1, "game.part1.rar", now.Add(-time.Hour)))
	f.repo.SeedFile(volume(3, "game.part3.rar", now.Add(-time.Hour)))
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckPending || len(f.tool.Inspected) != 0 || len(f.events.Messages()) != 0 {
		t.Fatalf("an incomplete set waits for its uploader: %+v", file)
	}

	late := newFixture(true)
	late.repo.SeedFile(volume(1, "game.part1.rar", now.Add(-25*time.Hour)))
	late.repo.SeedFile(volume(3, "game.part3.rar", now))
	if err := late.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int{1, 3} {
		if file, _ := late.repo.File(id); file.CheckStatus != download.CheckIncompleteSet {
			t.Fatalf("volume %d of an expired incomplete set is rejected: %+v", id, file)
		}
	}
	messages := late.events.Messages()
	meta := decodeMeta(t, messages[0])
	if len(messages) != 1 || meta["reason"] != "INCOMPLETE_SET" || fmt.Sprint(meta["missing_volumes"]) != "[2]" || meta["file_name"] != "game.part1.rar, game.part3.rar" {
		t.Fatalf("one message names the missing volumes: %+v %v", messages, meta)
	}
}

func TestWaitingSetsDoNotHoldUpOtherResources(t *testing.T) {
	f := newFixture(true)
	for id := 1; id <= 60; id++ {
		f.repo.SeedFile(volume(id, fmt.Sprintf("game.part%d.rar", id+1), now))
	}
	f.repo.SeedFile(pending(100, "/spool/100.part"))
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(100); file.CheckStatus != download.CheckOK {
		t.Fatalf("a later upload is checked while a set waits: %+v", file)
	}
}

func TestFailedChecksAreRetriedLater(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.tool.Contents["/spool/1.part"] = []string{"setup.exe"}
	f.scanner.Err = errors.New("clamd is down")
	if err := f.service.ScanPending(context.Background()); err == nil {
		t.Fatal("the failure is reported")
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckPending || !f.repo.RetryAt(10).Equal(now.Add(30*time.Minute)) {
		t.Fatalf("the resource waits before the next try: %+v %v", file, f.repo.RetryAt(10))
	}
	if err := f.service.ScanPending(context.Background()); err != nil || len(f.tool.Inspected) != 1 {
		t.Fatalf("a delayed resource is skipped: %v %v", err, f.tool.Inspected)
	}
}

func TestRemovedResourcesAreNotScanned(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	if _, err := f.repo.TakeDown(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if err := f.service.ScanPending(context.Background()); err != nil || len(f.tool.Inspected) != 0 {
		t.Fatalf("files of a removed resource are left alone: %v %v", err, f.tool.Inspected)
	}
}

func held(id int) scan.PendingFile {
	file := volume(id, fmt.Sprintf("game.part%d.rar", id), now)
	file.CheckStatus = download.CheckHarmfulPendingReview
	return file
}

func TestReviewAllowReleasesTheWholeResource(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	f.repo.SeedFile(held(1))
	f.repo.SeedFile(held(2))
	stored := volume(3, "bonus.zip", now)
	stored.Status, stored.CheckStatus = download.FileInObjectStore, download.CheckOK
	f.repo.SeedFile(stored)
	fileID, resourceID, gameID := 1, 10, 7
	scanCase := f.repo.SeedCase(scan.Case{FileID: &fileID, ResourceID: &resourceID, GameID: &gameID, UploaderID: 9, FileName: "game.part1.rar, game.part2.rar"})

	if _, err := f.service.Review(ctx, reviewer, 999, scan.ReviewInput{Decision: scan.DecisionAllow}); !errors.Is(err, scan.ErrCaseNotFound) {
		t.Fatalf("missing case: %v", err)
	}
	view, err := f.service.Review(ctx, reviewer, scanCase.ID, scan.ReviewInput{Decision: scan.DecisionAllow, Note: ptr("false positive")})
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != scan.CaseReleased || *view.DecisionSource != scan.SourceAdminAllow || *view.ReviewedBy != reviewer.UserID || !view.NotifyOnAllow || view.UploaderNotifiedAt == nil {
		t.Fatalf("released case %+v", view.Case)
	}
	for _, id := range []int{1, 2} {
		if got, _ := f.repo.File(id); got.CheckStatus != download.CheckOK {
			t.Fatalf("held file %d is released: %+v", id, got)
		}
	}
	if jobs := f.events.Jobs(); len(jobs) != 2 || jobs[0] != (download.StoreFile{FileID: 1}) || jobs[1] != (download.StoreFile{FileID: 2}) {
		t.Fatalf("released files are stored: %+v", jobs)
	}
	messages := f.events.Messages()
	if len(messages) != 1 || messages[0].Tone != message.ToneSuccess || decodeMeta(t, messages[0])["review_note"] != "false positive" {
		t.Fatalf("message %+v", messages)
	}
	if _, err := f.service.Review(ctx, reviewer, scanCase.ID, scan.ReviewInput{Decision: scan.DecisionDelete}); !errors.Is(err, scan.ErrCaseAlreadyProcessed) {
		t.Fatalf("processed case: %v", err)
	}
}

func TestReviewAllowWithoutNotification(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	scanCase := f.repo.SeedCase(scan.Case{UploaderID: 9})
	view, err := f.service.Review(ctx, reviewer, scanCase.ID, scan.ReviewInput{Decision: scan.DecisionAllow, NotifyUploader: ptr(false)})
	if err != nil || view.NotifyOnAllow || view.UploaderNotifiedAt != nil || len(f.events.Messages()) != 0 || len(f.events.Jobs()) != 0 {
		t.Fatalf("silent allow %+v %v", view.Case, err)
	}
}

func TestReviewDeleteTakesTheResourceDownAndBansRepeatOffenders(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	for _, id := range []int{1, 2} {
		f.repo.SeedFile(held(id))
	}
	f.repo.Keys[10] = []string{"games/7/5/bonus.zip"}
	fileID, resourceID, gameID := 1, 10, 7
	f.repo.Strikes[9] = 1
	scanCase := f.repo.SeedCase(scan.Case{FileID: &fileID, ResourceID: &resourceID, GameID: &gameID, UploaderID: 9, FileName: "game.part1.rar"})

	view, err := f.service.Review(ctx, reviewer, scanCase.ID, scan.ReviewInput{Decision: scan.DecisionDelete})
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != scan.CaseDeleted || *view.DecisionSource != scan.SourceAdminDelete {
		t.Fatalf("deleted case %+v", view.Case)
	}
	if !slices.Equal(f.repo.TakenDown, []int{10}) || !slices.Equal(f.repo.Purged, []string{"games/7/5/bonus.zip"}) {
		t.Fatalf("the whole resource is taken down and purged: %v %v", f.repo.TakenDown, f.repo.Purged)
	}
	if len(f.banner.Bans) != 1 || f.banner.Bans[0].UserID != 9 || f.banner.Bans[0].Days != 30 || *f.banner.Bans[0].BannedBy != reviewer.UserID || f.banner.Bans[0].Reason != "Uploaded harmful file (2 times)" {
		t.Fatalf("ban at the threshold %+v", f.banner.Bans)
	}
	messages := f.events.Messages()
	meta := decodeMeta(t, messages[0])
	if len(messages) != 1 || messages[0].Tone != message.ToneDestructive || meta["upload_injected_file_times"] != float64(2) || meta["malware_auto_ban_threshold"] != float64(2) || meta["review_note"] != nil {
		t.Fatalf("message %+v meta %v", messages, meta)
	}
}

func TestExpireOverdueAutoDeletes(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	overdue := f.repo.SeedCase(scan.Case{UploaderID: 9, ReviewDeadline: now.Add(-time.Minute)})
	future := f.repo.SeedCase(scan.Case{UploaderID: 9, ReviewDeadline: now.Add(time.Minute)})
	if err := f.service.ExpireOverdue(ctx); err != nil {
		t.Fatal(err)
	}
	got := f.repo.Case(overdue.ID)
	if got.Status != scan.CaseDeleted || *got.DecisionSource != scan.SourceTimeoutAutoDelete || got.ReviewedBy != nil || *got.ReviewNote != "Auto delete due to review timeout" || got.UploaderNotifiedAt == nil {
		t.Fatalf("overdue case %+v", got)
	}
	if f.repo.Case(future.ID).Status != scan.CasePending {
		t.Fatal("cases before their deadline wait")
	}
	if len(f.banner.Bans) != 0 {
		t.Fatal("first strike does not ban")
	}
}

func ptr[T any](v T) *T {
	return &v
}
