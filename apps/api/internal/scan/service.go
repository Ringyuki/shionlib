package scan

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type Options struct {
	Enabled bool
	SiteURL string
}

func checkReason(status download.CheckStatus) string {
	switch status {
	case download.CheckOK:
		return "OK"
	case download.CheckBrokenOrTruncated:
		return "BROKEN_OR_TRUNCATED"
	case download.CheckBrokenOrUnsupported:
		return "BROKEN_OR_UNSUPPORTED"
	case download.CheckEncrypted:
		return "ENCRYPTED"
	case download.CheckIncompleteSet:
		return "INCOMPLETE_SET"
	case download.CheckAbandoned:
		return "ABANDONED"
	default:
		return "HARMFUL"
	}
}

type Deps struct {
	Repo        Repository
	Archives    ArchiveTool
	Scanner     VirusScanner
	Workspace   Workspace
	Contents    *ContentService
	Inspections Inspections
	Files       Files
	Activities  Activities
	Messages    Messenger
	Banner      Banner
	Mailer      AdminMailer
	Queue       Queue
	Tx          Transactor
	Settings    setting.Source
	Options     Options
	Now         func() time.Time
}

type Service struct {
	repo        Repository
	archives    ArchiveTool
	scanner     VirusScanner
	workspace   Workspace
	contents    *ContentService
	inspections Inspections
	files       Files
	activities  Activities
	messages    Messenger
	banner      Banner
	mailer      AdminMailer
	queue       Queue
	tx          Transactor
	settings    setting.Source
	options     Options
	now         func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:        deps.Repo,
		archives:    deps.Archives,
		scanner:     deps.Scanner,
		workspace:   deps.Workspace,
		contents:    deps.Contents,
		inspections: deps.Inspections,
		files:       deps.Files,
		activities:  deps.Activities,
		messages:    deps.Messages,
		banner:      deps.Banner,
		mailer:      deps.Mailer,
		queue:       deps.Queue,
		tx:          deps.Tx,
		settings:    deps.Settings,
		options:     deps.Options,
		now:         deps.Now,
	}
}

func (s *Service) ScanPending(ctx context.Context) error {
	if !s.options.Enabled {
		return nil
	}
	resources, err := s.repo.PendingResources(ctx, s.now())
	if err != nil {
		return err
	}
	var errs []error
	for _, resourceID := range resources {
		if err := ctx.Err(); err != nil {
			return errors.Join(append(errs, err)...)
		}
		if err := s.scanResource(ctx, resourceID); err != nil {
			errs = append(errs, fmt.Errorf("scan resource %d: %w", resourceID, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) scanResource(ctx context.Context, resourceID int) error {
	settled := context.WithoutCancel(ctx)
	files, err := s.repo.ResourceFiles(ctx, resourceID)
	if err != nil {
		return errors.Join(err, s.repo.DelayCheck(settled, resourceID, s.now().Add(checkRetryDelay)))
	}
	waiting := slices.DeleteFunc(files, func(file PendingFile) bool { return !file.awaitingCheck() })
	var errs []error
	var wait time.Duration
	for _, unit := range Units(waiting) {
		err := s.check(ctx, unit)
		if err == nil {
			continue
		}
		errs = append(errs, fmt.Errorf("check %s: %w", strings.Join(unit.Names(), ", "), err))
		if errors.Is(ctx.Err(), context.Canceled) {
			break
		}
		delay, err := s.failed(settled, unit, err)
		if err != nil {
			errs = append(errs, fmt.Errorf("note the failed check of %s: %w", strings.Join(unit.Names(), ", "), err))
		}
		if delay > 0 && (wait == 0 || delay < wait) {
			wait = delay
		}
		if ctx.Err() != nil {
			break
		}
	}
	if wait > 0 {
		errs = append(errs, s.repo.DelayCheck(settled, resourceID, s.now().Add(wait)))
	}
	return errors.Join(errs...)
}

func (s *Service) failed(ctx context.Context, unit Unit, cause error) (time.Duration, error) {
	reason := failureReason(cause)
	attempts := CheckAttempts.Read(s.settings)
	deadline := s.now().Add(StalledCheckTimeout.Read(s.settings))
	failure := CheckFailure{Reason: reason}
	err := s.withPending(ctx, unit, func(ctx context.Context, current []PendingFile) error {
		for _, file := range current {
			failure.Failures = max(failure.Failures, file.CheckFailures)
		}
		failure.Failures++
		if failure.Failures >= attempts {
			at := s.now()
			failure.StalledAt = &at
		}
		for _, file := range current {
			if err := s.repo.RecordCheckFailure(ctx, file.ID, failure); err != nil {
				return err
			}
		}
		if failure.StalledAt == nil {
			return nil
		}
		entry := unit.Entry()
		return s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.File.Upload.FileCheckStalledTitle",
			Content:    "Messages.System.File.Upload.FileCheckStalledContent",
			GameID:     &entry.GameID,
			Meta:       message.Meta{"file_id": entry.ID, "file_name": strings.Join(unit.Names(), ", "), "file_names": unit.Names()},
			ReceiverID: entry.CreatorID,
		})
	})
	switch {
	case err != nil:
		return checkRetryDelay, err
	case failure.Failures == 0:
		return 0, nil
	case failure.StalledAt == nil:
		return retryDelay(failure.Failures), nil
	default:
		return 0, s.alertStalled(ctx, unit, failure, deadline)
	}
}

func (s *Service) alertStalled(ctx context.Context, unit Unit, failure CheckFailure, deadline time.Time) error {
	admins, err := s.repo.ActiveAdmins(ctx)
	if err != nil || len(admins) == 0 {
		return err
	}
	entry := unit.Entry()
	uploaderName, found, err := s.repo.UserName(ctx, entry.CreatorID)
	if err != nil {
		return err
	}
	if !found {
		uploaderName = "User#" + strconv.Itoa(entry.CreatorID)
	}
	name := strings.Join(unit.Names(), ", ")
	resourcePath := fmt.Sprintf(resourcePagePath, entry.ResourceID)
	linkText := "Messages.System.File.Upload.FileCheckStalledAdminLinkText"
	meta := message.Meta{
		"file_id":         entry.ID,
		"file_name":       name,
		"uploader_name":   uploaderName,
		"failures":        failure.Failures,
		"last_error":      failure.Excerpt(),
		"review_deadline": deadline,
	}
	var errs []error
	var recipients []string
	for _, admin := range admins {
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.File.Upload.FileCheckStalledAdminTitle",
			Content:    "Messages.System.File.Upload.FileCheckStalledAdminContent",
			LinkText:   &linkText,
			LinkURL:    &resourcePath,
			GameID:     &entry.GameID,
			Meta:       meta,
			ReceiverID: admin.ID,
		}); err != nil {
			errs = append(errs, err)
		}
		if admin.Email != "" {
			recipients = append(recipients, admin.Email)
		}
	}
	if s.mailer != nil && len(recipients) > 0 {
		titles, _, err := s.repo.GameTitles(ctx, entry.GameID)
		if err != nil {
			errs = append(errs, err)
		}
		if err := s.mailer.CheckStalled(ctx, recipients, StalledAlert{
			FileName:     name,
			UploaderName: uploaderName,
			GameTitle:    titles.Display(),
			Failures:     failure.Failures,
			Reason:       failure.Reason,
			Deadline:     deadline,
			ResourceURL:  strings.TrimSuffix(s.options.SiteURL, "/") + resourcePath,
		}); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *Service) check(ctx context.Context, unit Unit) error {
	if !unit.Complete() {
		if s.now().Before(unit.Oldest().Add(download.IncompleteSetTimeout.Read(s.settings))) {
			return nil
		}
		return s.reject(ctx, unit, download.CheckIncompleteSet)
	}
	workspace, err := s.workspace.Create(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = s.workspace.Discard(context.WithoutCancel(ctx), workspace) }()
	found, err := s.examine(ctx, unit, workspace)
	if err != nil {
		return err
	}
	if found.archive.Status != download.CheckOK {
		return s.reject(ctx, unit, found.archive.Status)
	}
	result, err := s.record(ctx, unit, found.archive, found.contents, found.reports)
	if err != nil {
		return err
	}
	if slices.ContainsFunc(found.contents.Draft.Entries, func(entry inspection.DraftEntry) bool { return entry.Kind == inspection.KindDisc }) {
		if err := s.files.DiscFound(ctx, unit.Entry().ResourceID); err != nil {
			return err
		}
	}
	if found.report.Infected {
		err = s.quarantine(ctx, unit, found.report, result, awaitingSameUpload)
	} else {
		err = s.approve(ctx, unit, result)
	}
	if err != nil {
		return err
	}
	return s.keepPreviews(ctx, result.recorded, found.contents.Previews)
}

func (s *Service) examine(ctx context.Context, unit Unit, workspace string) (examined, error) {
	entry, err := s.stage(ctx, unit, workspace)
	if err != nil {
		return examined{}, err
	}
	archive, err := InspectArchive(ctx, s.archives, entry)
	if err != nil || archive.Status != download.CheckOK {
		return examined{archive: archive}, err
	}
	contents, err := s.contents.Read(ctx, Source{Path: entry, Workspace: workspace, Archive: archive})
	if err != nil {
		return examined{}, err
	}
	reports, err := s.scanTargets(ctx, unit, entry, contents.Targets)
	if err != nil {
		return examined{}, err
	}
	report, err := MergeReports(reports)
	if err != nil {
		return examined{}, err
	}
	return examined{archive: archive, contents: contents, reports: reports, report: report}, nil
}

func (s *Service) stage(ctx context.Context, unit Unit, workspace string) (string, error) {
	if !unit.Set() {
		return unit.Entry().Path, nil
	}
	volumes := filepath.Join(workspace, "volumes")
	for _, file := range unit.Files {
		if err := s.workspace.Link(ctx, file.Path, filepath.Join(volumes, filepath.Base(file.Name))); err != nil {
			return "", err
		}
	}
	return filepath.Join(volumes, filepath.Base(unit.Entry().Name)), nil
}

func (s *Service) scanTargets(ctx context.Context, unit Unit, entry string, targets []ScanTarget) ([]EntryReport, error) {
	var entries []EntryReport
	if whole := unit.Entry(); !unit.Set() && Executable(whole.Name) && whole.Size <= s.scanner.MaxSize() {
		report, err := s.scanFile(ctx, whole.Name, entry)
		if err != nil {
			return nil, err
		}
		entries = append(entries, EntryReport{Name: whole.Name, Report: report})
	}
	for _, target := range targets {
		report, err := s.scanFile(ctx, target.Name, target.Path)
		if err != nil {
			return nil, err
		}
		entries = append(entries, EntryReport{Name: target.Name, Report: report})
	}
	return entries, nil
}

func (s *Service) record(ctx context.Context, unit Unit, archive Archive, contents Contents, reports []EntryReport) (checked, error) {
	engine, err := s.scanner.Engine(ctx)
	if err != nil {
		return checked{}, err
	}
	now := s.now()
	draft := contents.Draft
	draft.ResourceID = unit.Entry().ResourceID
	draft.Status = inspection.StatusPlain
	draft.Verified = archive.Verified
	if Container(archive.Facts.Format) {
		draft.Status = inspection.StatusReady
		draft.Archive = inspection.Archive{
			Format:          archive.Facts.Format,
			Solid:           archive.Facts.Solid,
			Volumes:         archive.Facts.Volumes,
			Recovery:        archive.Facts.Recovery,
			RecoveryPercent: archive.Facts.RecoveryPercent,
			NameEncoding:    contents.NameEncoding,
			Unsupported:     archive.Unsupported,
		}
	}
	draft.Scan = inspection.Scan{
		Engine:       engine.Name,
		SignaturesAt: engine.SignaturesAt,
		Scanned:      Executables(reports),
		Skipped:      contents.Skipped,
		Limit:        s.scanner.MaxSize(),
		Detections:   Detections(reports),
		At:           &now,
	}
	recorded, err := s.inspections.Record(ctx, draft)
	if err != nil {
		return checked{}, err
	}
	digests, err := s.digests(ctx, unit)
	if err != nil {
		return checked{}, err
	}
	return checked{recorded: recorded, digests: digests}, nil
}

func (s *Service) digests(ctx context.Context, unit Unit) (map[int]string, error) {
	digests := map[int]string{}
	for _, file := range unit.Files {
		digest, err := s.digest(ctx, file.Path)
		if err != nil {
			return nil, err
		}
		digests[file.ID] = digest
	}
	return digests, nil
}

func (s *Service) attachTo(ctx context.Context, files []PendingFile, result checked) error {
	for _, file := range files {
		if err := s.repo.SetInspection(ctx, file.ID, result.recorded.ID, result.digests[file.ID]); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) keepPreviews(ctx context.Context, recorded inspection.Recorded, previews []PreviewSource) error {
	for _, preview := range previews {
		if preview.Entry >= len(recorded.Entries) {
			continue
		}
		if err := s.keepPreview(ctx, recorded.ID, recorded.Entries[preview.Entry], preview); err != nil {
			return fmt.Errorf("keep the previews of inspection %d: %w", recorded.ID, err)
		}
	}
	return nil
}

func (s *Service) keepPreview(ctx context.Context, inspectionID, entryID int, preview PreviewSource) error {
	content, err := s.workspace.Open(ctx, preview.Path)
	if err != nil {
		return err
	}
	defer func() { _ = content.Close() }()
	return s.inspections.KeepPreview(ctx, inspectionID, entryID, preview.Kind, content)
}

func (s *Service) digest(ctx context.Context, path string) (string, error) {
	content, err := s.workspace.Open(ctx, path)
	if err != nil {
		return "", err
	}
	defer func() { _ = content.Close() }()
	hash := sha256.New()
	if _, err := io.Copy(hash, content); err != nil {
		return "", fmt.Errorf("digest %s: %w", filepath.Base(path), err)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (s *Service) scanFile(ctx context.Context, name, path string) (Report, error) {
	content, err := s.workspace.Open(ctx, path)
	if err != nil {
		return Report{}, err
	}
	defer func() { _ = content.Close() }()
	return s.scanner.Scan(ctx, name, content)
}

func (s *Service) withPending(ctx context.Context, unit Unit, fn func(ctx context.Context, current []PendingFile) error) error {
	return s.withUnchanged(ctx, unit, awaitingSameUpload, fn)
}

func (s *Service) withUnchanged(ctx context.Context, unit Unit, unchanged func(now, seen PendingFile) bool, fn func(ctx context.Context, current []PendingFile) error) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current := make([]PendingFile, 0, len(unit.Files))
		for _, file := range unit.Files {
			locked, found, err := s.repo.LockFile(ctx, file.ID)
			if err != nil {
				return err
			}
			if !found || !unchanged(locked, file) {
				return nil
			}
			current = append(current, locked)
		}
		return fn(ctx, current)
	})
}

func (s *Service) reject(ctx context.Context, unit Unit, status download.CheckStatus) error {
	return s.rejectWhen(ctx, unit, status, awaitingSameUpload)
}

func (s *Service) rejectWhen(ctx context.Context, unit Unit, status download.CheckStatus, unchanged func(now, seen PendingFile) bool) error {
	return s.withUnchanged(ctx, unit, unchanged, func(ctx context.Context, current []PendingFile) error {
		var size int64
		for _, file := range current {
			if err := s.repo.SetCheckStatus(ctx, file.ID, status, false); err != nil {
				return err
			}
			if err := s.activities.Record(ctx, checkActivity(rejectionActivity(status), file, status)); err != nil {
				return err
			}
			size += file.Size
		}
		entry := unit.Entry()
		meta := message.Meta{
			"file_id":           entry.ID,
			"file_name":         strings.Join(unit.Names(), ", "),
			"file_names":        unit.Names(),
			"file_size":         size,
			"file_check_status": int(status),
			"reason":            checkReason(status),
		}
		if len(unit.Absent) > 0 {
			meta["missing_volumes"] = unit.Absent
		}
		return s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneDestructive,
			Title:      "Messages.System.File.Upload.FileUploadFailedTitle",
			Content:    "Messages.System.File.Upload.FileCheckFailedContent",
			GameID:     &entry.GameID,
			Meta:       meta,
			ReceiverID: entry.CreatorID,
		})
	})
}

func rejectionActivity(status download.CheckStatus) activity.Type {
	switch status {
	case download.CheckBrokenOrTruncated, download.CheckIncompleteSet:
		return activity.TypeFileCheckBrokenOrTruncated
	case download.CheckBrokenOrUnsupported, download.CheckAbandoned:
		return activity.TypeFileCheckBrokenOrUnsupported
	default:
		return activity.TypeFileCheckEncrypted
	}
}

func (s *Service) approve(ctx context.Context, unit Unit, result checked) error {
	var approved []int
	err := s.withPending(ctx, unit, func(ctx context.Context, current []PendingFile) error {
		for _, file := range current {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckOK, false); err != nil {
				return err
			}
			if err := s.repo.SetInspection(ctx, file.ID, result.recorded.ID, result.digests[file.ID]); err != nil {
				return err
			}
			if err := s.activities.Record(ctx, checkActivity(activity.TypeFileCheckOK, file, download.CheckOK)); err != nil {
				return err
			}
			approved = append(approved, file.ID)
		}
		return nil
	})
	if err != nil {
		return err
	}
	for _, id := range approved {
		if err := s.queue.Enqueue(ctx, download.StoreFile{FileID: id}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) quarantine(ctx context.Context, unit Unit, report Report, result checked, unchanged func(now, seen PendingFile) bool) error {
	viruses := NormalizeViruses(report.Viruses)
	deadline := s.now().Add(ReviewTimeout.Read(s.settings))
	var created *Case
	err := s.withUnchanged(ctx, unit, unchanged, func(ctx context.Context, current []PendingFile) error {
		var size int64
		for _, file := range current {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckHarmfulPendingReview, false); err != nil {
				return err
			}
			if err := s.repo.SetInspection(ctx, file.ID, result.recorded.ID, result.digests[file.ID]); err != nil {
				return err
			}
			if err := s.activities.Record(ctx, checkActivity(activity.TypeFileCheckHarmful, file, download.CheckHarmful)); err != nil {
				return err
			}
			size += file.Size
		}
		entry := unit.Entry()
		name := strings.Join(unit.Names(), ", ")
		scanCase, err := s.repo.CreateCase(ctx, NewCase{
			FileID:         entry.ID,
			ResourceID:     entry.ResourceID,
			GameID:         entry.GameID,
			UploaderID:     entry.CreatorID,
			ReviewDeadline: deadline,
			Viruses:        viruses,
			ScanResult:     report.Result,
			ScanLogPath:    report.LogPath,
			ScanLogExcerpt: report.LogExcerpt,
			FileName:       name,
			FileSize:       size,
			FileHash:       entry.Hash,
			HashAlgorithm:  entry.HashAlgorithm,
		})
		if err != nil {
			return err
		}
		meta := message.Meta{
			"malware_case_id":  scanCase.ID,
			"file_name":        name,
			"review_deadline":  scanCase.ReviewDeadline,
			"detected_viruses": strings.Join(viruses, ", "),
		}
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.File.Upload.FileVirusReviewPendingTitle",
			Content:    "Messages.System.File.Upload.FileVirusReviewPendingContent",
			GameID:     &entry.GameID,
			Meta:       meta,
			ReceiverID: entry.CreatorID,
		}); err != nil {
			return err
		}
		created = &scanCase
		return nil
	})
	if err != nil || created == nil {
		return err
	}
	return s.alertAdmins(ctx, *created)
}

func (s *Service) alertAdmins(ctx context.Context, scanCase Case) error {
	admins, err := s.repo.ActiveAdmins(ctx)
	if err != nil || len(admins) == 0 {
		return err
	}
	uploaderName, found, err := s.repo.UserName(ctx, scanCase.UploaderID)
	if err != nil {
		return err
	}
	if !found {
		uploaderName = "User#" + strconv.Itoa(scanCase.UploaderID)
	}
	reviewPath := adminReviewPrefix + strconv.Itoa(scanCase.ID)
	meta := message.Meta{
		"malware_case_id":  scanCase.ID,
		"file_name":        scanCase.FileName,
		"uploader_name":    uploaderName,
		"detected_viruses": strings.Join(scanCase.Viruses, ", "),
		"review_deadline":  scanCase.ReviewDeadline,
	}
	linkText := "Messages.System.File.Upload.FileVirusReviewRequiredLinkText"
	var errs []error
	var recipients []string
	for _, admin := range admins {
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.File.Upload.FileVirusReviewRequiredTitle",
			Content:    "Messages.System.File.Upload.FileVirusReviewRequiredContent",
			LinkText:   &linkText,
			LinkURL:    &reviewPath,
			GameID:     scanCase.GameID,
			Meta:       meta,
			ReceiverID: admin.ID,
		}); err != nil {
			errs = append(errs, err)
		}
		if admin.Email != "" {
			recipients = append(recipients, admin.Email)
		}
	}
	if s.mailer != nil && len(recipients) > 0 {
		titles := GameTitles{}
		if scanCase.GameID != nil {
			if found, ok, err := s.repo.GameTitles(ctx, *scanCase.GameID); err != nil {
				errs = append(errs, err)
			} else if ok {
				titles = found
			}
		}
		if err := s.mailer.MalwareDetected(ctx, recipients, MalwareAlert{
			CaseID:       scanCase.ID,
			FileName:     scanCase.FileName,
			UploaderName: uploaderName,
			GameTitle:    titles.Display(),
			Viruses:      scanCase.Viruses,
			Deadline:     scanCase.ReviewDeadline,
			ReviewURL:    strings.TrimSuffix(s.options.SiteURL, "/") + reviewPath,
		}); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *Service) ExpireOverdue(ctx context.Context) error {
	ids, err := s.repo.ExpiredCases(ctx, s.now(), expiredCaseBatch)
	if err != nil {
		return err
	}
	notify := true
	note := AutoDeleteNote.Read(s.settings)
	var errs []error
	for _, id := range ids {
		if err := s.decide(ctx, id, ReviewInput{Decision: DecisionDelete, Note: &note, NotifyUploader: &notify}, SourceTimeoutAutoDelete, nil); err != nil {
			errs = append(errs, fmt.Errorf("expire malware case %d: %w", id, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) ReviewPolicy() ReviewPolicy {
	return ReviewPolicy{AutoBanThreshold: AutoBanThreshold.Read(s.settings), AutoBanDays: AutoBanDays.Read(s.settings)}
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]CaseView, int, error) {
	return s.repo.ListCases(ctx, filter, page)
}

func (s *Service) Get(ctx context.Context, id int) (CaseView, error) {
	return s.repo.GetCase(ctx, id)
}

func (s *Service) Review(ctx context.Context, who actor.Actor, id int, in ReviewInput) (CaseView, error) {
	source := SourceAdminDelete
	if in.Decision == DecisionAllow {
		source = SourceAdminAllow
	}
	reviewer := who.UserID
	if err := s.decide(ctx, id, in, source, &reviewer); err != nil {
		return CaseView{}, err
	}
	return s.repo.GetCase(ctx, id)
}

func (s *Service) decide(ctx context.Context, id int, in ReviewInput, source DecisionSource, reviewer *int) error {
	notify := in.NotifyUploader == nil || *in.NotifyUploader
	if in.Decision == DecisionAllow {
		return s.allow(ctx, id, in.Note, notify, source, reviewer)
	}
	return s.delete(ctx, id, in.Note, notify, source, reviewer)
}

func (s *Service) lockPending(ctx context.Context, id int) (Target, error) {
	target, err := s.repo.LockCase(ctx, id)
	if err != nil {
		return Target{}, err
	}
	if target.Status != CasePending {
		return Target{}, ErrCaseAlreadyProcessed
	}
	return target, nil
}

func (s *Service) allow(ctx context.Context, id int, note *string, notify bool, source DecisionSource, reviewer *int) error {
	var released []int
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.lockPending(ctx, id)
		if err != nil {
			return err
		}
		held, err := s.heldFiles(ctx, target)
		if err != nil {
			return err
		}
		var inspections []int
		for _, file := range held {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckOK, true); err != nil {
				return err
			}
			if err := s.activities.Record(ctx, checkActivity(activity.TypeFileCheckOK, file, download.CheckOK)); err != nil {
				return err
			}
			if file.Status == download.FileOnServer {
				released = append(released, file.ID)
			}
			if file.InspectionID != nil && !slices.Contains(inspections, *file.InspectionID) {
				inspections = append(inspections, *file.InspectionID)
			}
		}
		if err := s.inspections.Cleared(ctx, inspections); err != nil {
			return err
		}
		now := s.now()
		resolution := Resolution{Status: CaseReleased, Source: source, ReviewedBy: reviewer, ReviewedAt: now, Note: note, NotifyOnAllow: &notify}
		if notify {
			resolution.NotifiedAt = &now
		}
		if err := s.repo.ResolveCase(ctx, target.ID, resolution); err != nil {
			return err
		}
		if target.ResourceID != nil {
			if err := s.files.ReviewCleared(ctx, *target.ResourceID, target.FileName, reviewer); err != nil && !errors.Is(err, download.ErrResourceNotFound) {
				return err
			}
		}
		if !notify {
			return nil
		}
		return s.notifyUploader(ctx, target, message.ToneSuccess, "FileVirusFalsePositiveReleased", message.Meta{
			"malware_case_id": target.ID,
			"file_name":       target.FileName,
			"review_note":     note,
		})
	})
	if err != nil {
		return err
	}
	for _, fileID := range released {
		if err := s.queue.Enqueue(ctx, download.StoreFile{FileID: fileID}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) heldFiles(ctx context.Context, target Target) ([]PendingFile, error) {
	if target.ResourceID == nil {
		return nil, nil
	}
	files, err := s.repo.ResourceFiles(ctx, *target.ResourceID)
	if err != nil {
		return nil, err
	}
	return slices.DeleteFunc(files, func(file PendingFile) bool {
		return file.CheckStatus != download.CheckHarmfulPendingReview
	}), nil
}

func (s *Service) delete(ctx context.Context, id int, note *string, notify bool, source DecisionSource, reviewer *int) error {
	var keys []string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.lockPending(ctx, id)
		if err != nil {
			return err
		}
		strikes, err := s.repo.AddStrike(ctx, target.UploaderID)
		if err != nil {
			return err
		}
		if threshold := AutoBanThreshold.Read(s.settings); strikes == threshold {
			reason := fmt.Sprintf("Uploaded harmful file (%d times)", threshold)
			if _, err := s.banner.Ban(ctx, target.UploaderID, reviewer, reason, AutoBanDays.Read(s.settings)); err != nil {
				return err
			}
		}
		if target.ResourceID != nil {
			keys, err = s.files.TakeDown(ctx, *target.ResourceID)
			if err != nil && !errors.Is(err, download.ErrResourceNotFound) {
				return err
			}
		}
		now := s.now()
		resolution := Resolution{Status: CaseDeleted, Source: source, ReviewedBy: reviewer, ReviewedAt: now, Note: note}
		if notify {
			resolution.NotifiedAt = &now
		}
		if err := s.repo.ResolveCase(ctx, target.ID, resolution); err != nil {
			return err
		}
		if !notify {
			return nil
		}
		return s.notifyUploader(ctx, target, message.ToneDestructive, "FileVirusConfirmedDeleted", message.Meta{
			"malware_case_id":            target.ID,
			"file_name":                  target.FileName,
			"upload_injected_file_times": strikes,
			"malware_auto_ban_threshold": AutoBanThreshold.Read(s.settings),
			"review_note":                note,
		})
	})
	if err != nil {
		return err
	}
	return s.files.PurgeLater(ctx, keys)
}

func (s *Service) notifyUploader(ctx context.Context, target Target, tone message.Tone, key string, meta message.Meta) error {
	return s.messages.Send(ctx, message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       tone,
		Title:      "Messages.System.File.Upload." + key + "Title",
		Content:    "Messages.System.File.Upload." + key + "Content",
		GameID:     target.GameID(),
		Meta:       meta,
		ReceiverID: target.UploaderID,
	})
}

func checkActivity(kind activity.Type, file PendingFile, check download.CheckStatus) activity.NewActivity {
	fileID, status, checkValue := file.ID, file.Status, int(check)
	return activity.NewActivity{
		Type:            kind,
		UserID:          file.CreatorID,
		GameID:          &file.GameID,
		FileID:          &fileID,
		FileStatus:      &status,
		FileCheckStatus: &checkValue,
		FileSize:        &file.Size,
		FileName:        &file.Name,
	}
}
