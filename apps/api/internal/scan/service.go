package scan

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type Options struct {
	Enabled          bool
	ReviewTimeout    time.Duration
	AutoBanThreshold int
	AutoBanDays      int
	AutoDeleteNote   string
	SiteURL          string
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
	default:
		return "HARMFUL"
	}
}

type Deps struct {
	Repo       Repository
	Archives   ArchiveTool
	Scanner    VirusScanner
	Files      Files
	Local      LocalFiles
	Quota      Quota
	Activities Activities
	Messages   Messenger
	Banner     Banner
	Mailer     AdminMailer
	Queue      Queue
	Tx         Transactor
	Options    Options
	Now        func() time.Time
}

type Service struct {
	repo       Repository
	archives   ArchiveTool
	scanner    VirusScanner
	files      Files
	local      LocalFiles
	quota      Quota
	activities Activities
	messages   Messenger
	banner     Banner
	mailer     AdminMailer
	queue      Queue
	tx         Transactor
	options    Options
	now        func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:       deps.Repo,
		archives:   deps.Archives,
		scanner:    deps.Scanner,
		files:      deps.Files,
		local:      deps.Local,
		quota:      deps.Quota,
		activities: deps.Activities,
		messages:   deps.Messages,
		banner:     deps.Banner,
		mailer:     deps.Mailer,
		queue:      deps.Queue,
		tx:         deps.Tx,
		options:    deps.Options,
		now:        deps.Now,
	}
}

func (s *Service) ScanPending(ctx context.Context) error {
	if !s.options.Enabled {
		return nil
	}
	pending, err := s.repo.ListPending(ctx, pendingFileBatch)
	if err != nil {
		return err
	}
	var errs []error
	for _, file := range pending {
		if err := ctx.Err(); err != nil {
			return errors.Join(append(errs, err)...)
		}
		if err := s.scanFile(ctx, file); err != nil {
			errs = append(errs, fmt.Errorf("scan file %d: %w", file.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (s *Service) scanFile(ctx context.Context, file PendingFile) error {
	status, err := InspectArchive(ctx, s.archives, file.Path)
	if err != nil {
		return err
	}
	if status != download.CheckOK {
		return s.reject(ctx, file, status)
	}
	report, err := s.scanner.Scan(ctx, file.Path)
	if err != nil {
		return err
	}
	if report.Infected {
		return s.quarantine(ctx, file, report)
	}
	return s.approve(ctx, file)
}

func (s *Service) withPending(ctx context.Context, file PendingFile, fn func(ctx context.Context, current PendingFile) error) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		current, found, err := s.repo.LockFile(ctx, file.ID)
		if err != nil || !found {
			return err
		}
		if current.Type != download.FileTypeObjectStore || current.Status != download.FileOnServer || current.CheckStatus != download.CheckPending || current.Path != file.Path {
			return nil
		}
		return fn(ctx, current)
	})
}

func (s *Service) reject(ctx context.Context, file PendingFile, status download.CheckStatus) error {
	return s.withPending(ctx, file, func(ctx context.Context, current PendingFile) error {
		if err := s.repo.SetCheckStatus(ctx, current.ID, status, false); err != nil {
			return err
		}
		if current.UploadSessionID != nil {
			if err := s.quota.Withdraw(ctx, current.CreatorID, *current.UploadSessionID); err != nil {
				return err
			}
		}
		if err := s.activities.Record(ctx, checkActivity(rejectionActivity(status), current, status)); err != nil {
			return err
		}
		meta := message.Meta{
			"file_id":           current.ID,
			"file_name":         current.Name,
			"file_size":         current.Size,
			"file_check_status": int(status),
			"reason":            checkReason(status),
		}
		return s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneDestructive,
			Title:      "Messages.System.File.Upload.FileUploadFailedTitle",
			Content:    "Messages.System.File.Upload.FileCheckFailedContent",
			GameID:     &current.GameID,
			Meta:       meta,
			ReceiverID: current.CreatorID,
		})
	})
}

func rejectionActivity(status download.CheckStatus) activity.Type {
	switch status {
	case download.CheckBrokenOrTruncated:
		return activity.TypeFileCheckBrokenOrTruncated
	case download.CheckBrokenOrUnsupported:
		return activity.TypeFileCheckBrokenOrUnsupported
	default:
		return activity.TypeFileCheckEncrypted
	}
}

func (s *Service) approve(ctx context.Context, file PendingFile) error {
	if err := s.queue.Enqueue(ctx, download.StoreFile{FileID: file.ID}); err != nil {
		return err
	}
	return s.withPending(ctx, file, func(ctx context.Context, current PendingFile) error {
		if err := s.repo.SetCheckStatus(ctx, current.ID, download.CheckOK, false); err != nil {
			return err
		}
		return s.activities.Record(ctx, checkActivity(activity.TypeFileCheckOK, current, download.CheckOK))
	})
}

func (s *Service) quarantine(ctx context.Context, file PendingFile, report Report) error {
	viruses := NormalizeViruses(report.Viruses)
	deadline := s.now().Add(s.options.ReviewTimeout)
	var created *Case
	err := s.withPending(ctx, file, func(ctx context.Context, current PendingFile) error {
		if err := s.repo.SetCheckStatus(ctx, current.ID, download.CheckHarmfulPendingReview, false); err != nil {
			return err
		}
		if err := s.activities.Record(ctx, checkActivity(activity.TypeFileCheckHarmful, current, download.CheckHarmful)); err != nil {
			return err
		}
		scanCase, err := s.repo.CreateCase(ctx, NewCase{
			FileID:         current.ID,
			ResourceID:     current.ResourceID,
			GameID:         current.GameID,
			UploaderID:     current.CreatorID,
			ReviewDeadline: deadline,
			Viruses:        viruses,
			ScanResult:     report.Result,
			ScanLogPath:    report.LogPath,
			ScanLogExcerpt: report.LogExcerpt,
			FileName:       current.Name,
			FileSize:       current.Size,
			FileHash:       current.Hash,
			HashAlgorithm:  current.HashAlgorithm,
		})
		if err != nil {
			return err
		}
		meta := message.Meta{
			"malware_case_id":  scanCase.ID,
			"file_name":        current.Name,
			"review_deadline":  scanCase.ReviewDeadline,
			"detected_viruses": strings.Join(viruses, ", "),
		}
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.File.Upload.FileVirusReviewPendingTitle",
			Content:    "Messages.System.File.Upload.FileVirusReviewPendingContent",
			GameID:     &current.GameID,
			Meta:       meta,
			ReceiverID: current.CreatorID,
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
	note := s.options.AutoDeleteNote
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
	var released *int
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.lockPending(ctx, id)
		if err != nil {
			return err
		}
		if target.File != nil {
			if err := s.repo.SetCheckStatus(ctx, target.File.ID, download.CheckOK, true); err != nil {
				return err
			}
			fileID, status, check := target.File.ID, download.FileOnServer, int(download.CheckOK)
			if err := s.activities.Record(ctx, activity.NewActivity{
				Type:            activity.TypeFileCheckOK,
				UserID:          target.UploaderID,
				GameID:          target.GameID(),
				FileID:          &fileID,
				FileStatus:      &status,
				FileCheckStatus: &check,
				FileSize:        &target.File.Size,
				FileName:        &target.File.Name,
			}); err != nil {
				return err
			}
			released = &fileID
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
	if err != nil || released == nil {
		return err
	}
	return s.queue.Enqueue(ctx, download.StoreFile{FileID: *released})
}

func (s *Service) delete(ctx context.Context, id int, note *string, notify bool, source DecisionSource, reviewer *int) error {
	var localPath *string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.lockPending(ctx, id)
		if err != nil {
			return err
		}
		strikes, err := s.repo.AddStrike(ctx, target.UploaderID)
		if err != nil {
			return err
		}
		if strikes == s.options.AutoBanThreshold {
			reason := fmt.Sprintf("Uploaded harmful file (%d times)", s.options.AutoBanThreshold)
			if _, err := s.banner.Ban(ctx, target.UploaderID, reviewer, reason, s.options.AutoBanDays); err != nil {
				return err
			}
		}
		if target.File != nil {
			removed, found, err := s.files.RemoveFile(ctx, target.File.ID)
			if err != nil {
				return err
			}
			if found {
				localPath = removed.Path
				if removed.UploadSessionID != nil {
					if err := s.quota.Withdraw(ctx, target.UploaderID, *removed.UploadSessionID); err != nil {
						return err
					}
				}
			}
		} else if target.ResourceID != nil {
			if err := s.files.RemoveEmptyResource(ctx, *target.ResourceID); err != nil {
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
			"malware_auto_ban_threshold": s.options.AutoBanThreshold,
			"review_note":                note,
		})
	})
	if err != nil {
		return err
	}
	if localPath != nil && s.local.Owns(*localPath) {
		_ = s.local.Remove(ctx, *localPath)
	}
	return nil
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
