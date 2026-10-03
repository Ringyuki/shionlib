package scan_test

import (
	"context"
	"encoding/json"
	"errors"
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
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

var (
	now      = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	reviewer = actor.Actor{UserID: 50, Role: actor.RoleAdmin}
)

type withdrawal struct {
	UserID    int
	SessionID int
}

type quota struct {
	withdrawn []withdrawal
}

func (q *quota) Withdraw(_ context.Context, userID, sessionID int) error {
	q.withdrawn = append(q.withdrawn, withdrawal{userID, sessionID})
	return nil
}

type fixture struct {
	repo    *scantest.MemoryRepository
	tool    *scantest.ArchiveTool
	scanner *scantest.Scanner
	spool   *uploadtest.MemorySpool
	quota   *quota
	events  *downloadtest.Recorder
	banner  *scantest.Banner
	mailer  *scantest.Mailer
	service *scan.Service
}

func newFixture(enabled bool) fixture {
	f := fixture{
		repo:    scantest.NewMemoryRepository(func() time.Time { return now }),
		tool:    &scantest.ArchiveTool{Listings: map[string]scan.ToolRun{}, Tests: map[string]scan.ToolRun{}},
		scanner: &scantest.Scanner{Reports: map[string]scan.Report{}},
		spool:   uploadtest.NewMemorySpool(),
		quota:   &quota{},
		events:  &downloadtest.Recorder{},
		banner:  &scantest.Banner{Applied: true},
		mailer:  &scantest.Mailer{},
	}
	f.service = scan.NewService(scan.Deps{
		Repo:       f.repo,
		Archives:   f.tool,
		Scanner:    f.scanner,
		Files:      f.repo,
		Local:      f.spool,
		Quota:      f.quota,
		Activities: f.events,
		Messages:   f.events,
		Banner:     f.banner,
		Mailer:     f.mailer,
		Queue:      f.events,
		Tx:         &txtest.Immediate{},
		Settings: scan.Settings{
			Enabled:          enabled,
			ReviewTimeout:    24 * time.Hour,
			AutoBanThreshold: 2,
			AutoBanDays:      30,
			AutoDeleteNote:   "Auto delete due to review timeout",
			SiteURL:          "https://shionlib.example/",
		},
		Now: func() time.Time { return now },
	})
	return f
}

func pending(id int, path string) scan.PendingFile {
	session := 100 + id
	return scan.PendingFile{ID: id, ResourceID: id * 10, GameID: 7, Type: download.FileTypeObjectStore, Status: download.FileOnServer, Path: path, Name: "file.7z", Size: 1024, Hash: "b3", HashAlgorithm: "blake3", UploadSessionID: &session, CreatorID: 9}
}

func decodeMeta(t *testing.T, msg message.NewMessage) map[string]any {
	t.Helper()
	var meta map[string]any
	if err := json.Unmarshal(msg.Meta, &meta); err != nil {
		t.Fatal(err)
	}
	return meta
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
			if err != nil || got != tc.want {
				t.Fatalf("got %d %v want %d", got, err, tc.want)
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
	if !slices.Equal(f.quota.withdrawn, []withdrawal{{UserID: 9, SessionID: 101}}) {
		t.Fatalf("rejected uploads are refunded: %+v", f.quota.withdrawn)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileCheckEncrypted || *recorded[0].FileCheckStatus != 4 || *recorded[0].FileStatus != 2 {
		t.Fatalf("activity %+v", recorded)
	}
	messages := f.events.Messages()
	meta := decodeMeta(t, messages[0])
	if len(messages) != 1 || messages[0].Tone != message.ToneDestructive || messages[0].Title != "Messages.System.File.Upload.FileUploadFailedTitle" || meta["reason"] != "ENCRYPTED" || meta["file_check_status"] != float64(4) {
		t.Fatalf("message %+v meta %v", messages, meta)
	}
	if len(f.events.Jobs()) != 0 {
		t.Fatal("rejected files are never stored")
	}
}

func TestScanApprovesCleanFiles(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
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

func TestScanQuarantinesInfectedFiles(t *testing.T) {
	f := newFixture(true)
	f.repo.SeedFile(pending(1, "/spool/1.part"))
	f.repo.Admins = []scan.Admin{{ID: 50, Email: "a@example.com"}, {ID: 51}}
	f.repo.Names[9] = "uploader"
	f.repo.Titles[7] = scan.GameTitles{ID: 7, TitleJP: "ゲーム"}
	logPath := "/var/log/clamav-scan.log"
	f.scanner.Reports["/spool/1.part"] = scan.Report{Infected: true, Viruses: []string{" Eicar ", "Eicar", "Trojan"}, Result: json.RawMessage(`{"isInfected":true}`), LogPath: &logPath}
	if err := f.service.ScanPending(context.Background()); err != nil {
		t.Fatal(err)
	}
	if file, _ := f.repo.File(1); file.CheckStatus != download.CheckHarmfulPendingReview {
		t.Fatalf("check status %d", file.CheckStatus)
	}
	scanCase := f.repo.Case(1)
	if scanCase.Status != scan.CasePending || !slices.Equal(scanCase.Viruses, []string{"Eicar", "Trojan"}) || !scanCase.ReviewDeadline.Equal(now.Add(24*time.Hour)) || *scanCase.ScanLogPath != logPath {
		t.Fatalf("case %+v", scanCase)
	}
	recorded := f.events.Activities()
	if len(recorded) != 1 || recorded[0].Type != activity.TypeFileCheckHarmful || *recorded[0].FileCheckStatus != int(download.CheckHarmful) {
		t.Fatalf("activity %+v", recorded)
	}
	messages := f.events.Messages()
	if len(messages) != 3 || messages[0].ReceiverID != 9 || messages[1].ReceiverID != 50 || messages[2].ReceiverID != 51 {
		t.Fatalf("uploader and admins are told: %+v", messages)
	}
	if meta := decodeMeta(t, messages[0]); meta["detected_viruses"] != "Eicar, Trojan" || meta["review_deadline"] != "2026-10-04T12:00:00.000Z" {
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

func TestReviewAllowReleasesTheFile(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	file := pending(1, "/spool/1.part")
	file.CheckStatus = download.CheckHarmfulPendingReview
	f.repo.SeedFile(file)
	fileID, resourceID, gameID := 1, 10, 7
	scanCase := f.repo.SeedCase(scan.Case{FileID: &fileID, ResourceID: &resourceID, GameID: &gameID, UploaderID: 9, FileName: "file.7z"})

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
	if got, _ := f.repo.File(1); got.CheckStatus != download.CheckOK {
		t.Fatalf("file %+v", got)
	}
	if jobs := f.events.Jobs(); len(jobs) != 1 || jobs[0] != (download.StoreFile{FileID: 1}) {
		t.Fatalf("store job %+v", jobs)
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

func TestReviewDeleteRemovesTheFileAndBansRepeatOffenders(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	file := pending(1, uploadtest.SpoolRoot+"1.part")
	f.spool.Put(file.Path, []byte("virus"), now)
	f.repo.SeedFile(file)
	fileID, resourceID, gameID := 1, 10, 7
	f.repo.Strikes[9] = 1
	scanCase := f.repo.SeedCase(scan.Case{FileID: &fileID, ResourceID: &resourceID, GameID: &gameID, UploaderID: 9, FileName: "file.7z"})

	view, err := f.service.Review(ctx, reviewer, scanCase.ID, scan.ReviewInput{Decision: scan.DecisionDelete})
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != scan.CaseDeleted || *view.DecisionSource != scan.SourceAdminDelete {
		t.Fatalf("deleted case %+v", view.Case)
	}
	if _, ok := f.repo.File(1); ok || f.repo.HasResource(10) {
		t.Fatal("the file and its now empty resource are deleted")
	}
	if len(f.banner.Bans) != 1 || f.banner.Bans[0].UserID != 9 || f.banner.Bans[0].Days != 30 || *f.banner.Bans[0].BannedBy != reviewer.UserID || f.banner.Bans[0].Reason != "Uploaded harmful file (2 times)" {
		t.Fatalf("ban at the threshold %+v", f.banner.Bans)
	}
	if !slices.Equal(f.quota.withdrawn, []withdrawal{{UserID: 9, SessionID: 101}}) {
		t.Fatalf("refund %+v", f.quota.withdrawn)
	}
	if _, ok := f.spool.Content(file.Path); ok {
		t.Fatal("local copy removed")
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
