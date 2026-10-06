package scan

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
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
	default:
		return "HARMFUL"
	}
}

type Deps struct {
	Repo       Repository
	Archives   ArchiveTool
	Scanner    VirusScanner
	Workspace  Workspace
	Spool      Spool
	Files      Files
	Activities Activities
	Messages   Messenger
	Banner     Banner
	Mailer     AdminMailer
	Queue      Queue
	Tx         Transactor
	Settings   setting.Source
	Options    Options
	Now        func() time.Time
}

type Service struct {
	repo       Repository
	archives   ArchiveTool
	scanner    VirusScanner
	workspace  Workspace
	spool      Spool
	files      Files
	activities Activities
	messages   Messenger
	banner     Banner
	mailer     AdminMailer
	queue      Queue
	tx         Transactor
	settings   setting.Source
	options    Options
	now        func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:       deps.Repo,
		archives:   deps.Archives,
		scanner:    deps.Scanner,
		workspace:  deps.Workspace,
		spool:      deps.Spool,
		files:      deps.Files,
		activities: deps.Activities,
		messages:   deps.Messages,
		banner:     deps.Banner,
		mailer:     deps.Mailer,
		queue:      deps.Queue,
		tx:         deps.Tx,
		settings:   deps.Settings,
		options:    deps.Options,
		now:        deps.Now,
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
			delayErr := s.repo.DelayCheck(context.WithoutCancel(ctx), resourceID, s.now().Add(checkRetryDelay))
			errs = append(errs, fmt.Errorf("scan resource %d: %w", resourceID, errors.Join(err, delayErr)))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) scanResource(ctx context.Context, resourceID int) error {
	files, err := s.repo.ResourceFiles(ctx, resourceID)
	if err != nil {
		return err
	}
	waiting := slices.DeleteFunc(files, func(file PendingFile) bool { return !file.awaitingCheck() })
	var errs []error
	for _, unit := range Units(waiting) {
		if err := s.check(ctx, unit); err != nil {
			errs = append(errs, fmt.Errorf("check %s: %w", strings.Join(unit.Names(), ", "), err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) check(ctx context.Context, unit Unit) error {
	if !unit.Complete() {
		if s.now().Before(unit.Oldest().Add(IncompleteSetTimeout.Read(s.settings))) {
			return nil
		}
		return s.reject(ctx, unit, download.CheckIncompleteSet)
	}
	workspace, err := s.workspace.Create(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = s.workspace.Discard(context.WithoutCancel(ctx), workspace) }()
	entry, err := s.stage(ctx, unit, workspace)
	if err != nil {
		return err
	}
	archive, err := InspectArchive(ctx, s.archives, entry)
	if err != nil {
		return err
	}
	if archive.Status != download.CheckOK {
		return s.reject(ctx, unit, archive.Status)
	}
	report, err := s.scanContents(ctx, unit, entry, workspace, archive.Entries)
	if err != nil {
		return err
	}
	if report.Infected {
		return s.quarantine(ctx, unit, report)
	}
	return s.approve(ctx, unit)
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

func (s *Service) scanContents(ctx context.Context, unit Unit, entry, workspace string, listed []ArchiveEntry) (Report, error) {
	limit := s.scanner.MaxSize()
	var entries []EntryReport
	if whole := unit.Entry(); !unit.Set() && Executable(whole.Name) && whole.Size <= limit {
		report, err := s.scanFile(ctx, whole.Name, entry)
		if err != nil {
			return Report{}, err
		}
		entries = append(entries, EntryReport{Name: whole.Name, Report: report})
	}
	skip, size := extractionPlan(listed, limit)
	room, err := s.spool.SpoolRoom(ctx)
	if err != nil {
		return Report{}, err
	}
	if size > room {
		return Report{}, fmt.Errorf("extracting %d bytes needs more than the %d bytes the spool can spare", size, room)
	}
	extracted := filepath.Join(workspace, "contents")
	run, err := s.archives.Extract(ctx, entry, extracted, ScannedExtensions, skip)
	if err != nil {
		return Report{}, err
	}
	if run.Failed && !run.Killed {
		return Report{}, fmt.Errorf("extract executables: %s", strings.TrimSpace(run.blob()))
	}
	paths, err := s.workspace.Files(ctx, extracted)
	if err != nil {
		return Report{}, err
	}
	for _, path := range paths {
		name, err := filepath.Rel(extracted, path)
		if err != nil {
			return Report{}, err
		}
		report, err := s.scanFile(ctx, name, path)
		if err != nil {
			return Report{}, err
		}
		entries = append(entries, EntryReport{Name: name, Report: report})
	}
	return MergeReports(entries)
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
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current := make([]PendingFile, 0, len(unit.Files))
		for _, file := range unit.Files {
			locked, found, err := s.repo.LockFile(ctx, file.ID)
			if err != nil {
				return err
			}
			if !found || !locked.awaitingCheck() || locked.Path != file.Path {
				return nil
			}
			current = append(current, locked)
		}
		return fn(ctx, current)
	})
}

func (s *Service) reject(ctx context.Context, unit Unit, status download.CheckStatus) error {
	return s.withPending(ctx, unit, func(ctx context.Context, current []PendingFile) error {
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
		if len(unit.Missing) > 0 {
			meta["missing_volumes"] = unit.Missing
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
	case download.CheckBrokenOrUnsupported:
		return activity.TypeFileCheckBrokenOrUnsupported
	default:
		return activity.TypeFileCheckEncrypted
	}
}

func (s *Service) approve(ctx context.Context, unit Unit) error {
	var approved []int
	err := s.withPending(ctx, unit, func(ctx context.Context, current []PendingFile) error {
		for _, file := range current {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckOK, false); err != nil {
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

func (s *Service) quarantine(ctx context.Context, unit Unit, report Report) error {
	viruses := NormalizeViruses(report.Viruses)
	deadline := s.now().Add(ReviewTimeout.Read(s.settings))
	var created *Case
	err := s.withPending(ctx, unit, func(ctx context.Context, current []PendingFile) error {
		var size int64
		for _, file := range current {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckHarmfulPendingReview, false); err != nil {
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
		for _, file := range held {
			if err := s.repo.SetCheckStatus(ctx, file.ID, download.CheckOK, true); err != nil {
				return err
			}
			if err := s.activities.Record(ctx, checkActivity(activity.TypeFileCheckOK, file, download.CheckOK)); err != nil {
				return err
			}
			released = append(released, file.ID)
		}
		now := s.now()
		resolution := Resolution{Status: CaseReleased, Source: source, ReviewedBy: reviewer, ReviewedAt: now, Note: note, NotifyOnAllow: &notify}
		if notify {
			resolution.NotifiedAt = &now
		}
		if err := s.repo.ResolveCase(ctx, target.ID, resolution); err != nil {
			return err
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
		return file.Status != download.FileOnServer || file.CheckStatus != download.CheckHarmfulPendingReview
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
	fileID, status, checkValue := file.ID, download.FileOnServer, int(check)
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
