package report

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Deps struct {
	Repo      Repository
	Resources Resources
	Quota     Quota
	Banner    Banner
	Messages  Messenger
	Mailer    AdminMailer
	Queue     Queue
	Tx        Transactor
	SiteURL   string
	Now       func() time.Time
}

type Service struct {
	repo      Repository
	resources Resources
	quota     Quota
	banner    Banner
	messages  Messenger
	mailer    AdminMailer
	queue     Queue
	tx        Transactor
	siteURL   string
	now       func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:      deps.Repo,
		resources: deps.Resources,
		quota:     deps.Quota,
		banner:    deps.Banner,
		messages:  deps.Messages,
		mailer:    deps.Mailer,
		queue:     deps.Queue,
		tx:        deps.Tx,
		siteURL:   deps.SiteURL,
		now:       deps.Now,
	}
}

func (s *Service) Create(ctx context.Context, who actor.Actor, resourceID int, in CreateInput) (Report, error) {
	resource, err := s.resources.Resource(ctx, resourceID)
	if err != nil {
		return Report{}, err
	}
	if resource.Status != download.ResourceActive {
		return Report{}, download.ErrResourceNotFound
	}
	if resource.CreatorID == who.UserID {
		return Report{}, ErrSelfReport
	}
	invalid, err := s.repo.CountInvalidSince(ctx, who.UserID, s.now().Add(-FalseReportWindow))
	if err != nil {
		return Report{}, err
	}
	if invalid >= SuspendThreshold {
		return Report{}, ErrSuspended
	}
	pending, err := s.repo.HasPending(ctx, resourceID, who.UserID)
	if err != nil {
		return Report{}, err
	}
	if pending {
		return Report{}, ErrDuplicated
	}
	created, err := s.repo.Create(ctx, NewReport{
		ResourceID:     resourceID,
		ReporterID:     who.UserID,
		ReportedUserID: resource.CreatorID,
		Reason:         in.Reason,
		Detail:         in.Detail,
		Level:          DefaultLevel(in.Reason),
	})
	if err != nil {
		return Report{}, err
	}
	if err := s.queue.Enqueue(ctx, AlertAdmins{ReportID: created.ID}); err != nil {
		return Report{}, err
	}
	return created, nil
}

func (s *Service) AlertAdmins(ctx context.Context, reportID int) error {
	view, err := s.repo.Get(ctx, reportID)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	admins, err := s.repo.ActiveAdmins(ctx)
	if err != nil || len(admins) == 0 {
		return err
	}
	reviewPath := adminReviewPrefix + strconv.Itoa(view.ID)
	meta := message.Meta{
		"report_id":          view.ID,
		"reporter_name":      displayName(view.Reporter),
		"reported_user_name": displayName(view.ReportedUser),
		"reason":             view.Reason,
		"malicious_level":    view.Level,
	}
	linkText := "Messages.System.Report.NewReport.LinkText"
	gameID := view.Resource.GameID
	var errs []error
	var recipients []string
	for _, admin := range admins {
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneWarning,
			Title:      "Messages.System.Report.NewReport.Title",
			Content:    "Messages.System.Report.NewReport.Content",
			LinkText:   &linkText,
			LinkURL:    &reviewPath,
			GameID:     &gameID,
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
		if err := s.mailer.ReportFiled(ctx, recipients, ReportAlert{
			ReportID:         view.ID,
			ReporterName:     displayName(view.Reporter),
			ReportedUserName: displayName(view.ReportedUser),
			Reason:           view.Reason,
			Level:            view.Level,
			GameTitle:        view.Resource.Game.Display(),
			Detail:           view.Detail,
			ReviewURL:        strings.TrimSuffix(s.siteURL, "/") + reviewPath,
		}); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func displayName(member Member) string {
	if member.Name != "" {
		return member.Name
	}
	return "User#" + strconv.Itoa(member.ID)
}

func (s *Service) List(ctx context.Context, filter ListFilter, page Page) ([]View, int, error) {
	return s.repo.List(ctx, filter, page)
}

func (s *Service) Get(ctx context.Context, id int) (View, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Review(ctx context.Context, who actor.Actor, id int, in ReviewInput) (View, error) {
	notify := in.Notify == nil || *in.Notify
	remove := in.Verdict == VerdictValid && (in.RemoveResource == nil || *in.RemoveResource)
	var purge []string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		report, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if report.Status != StatusPending {
			return ErrAlreadyProcessed
		}
		resource, err := s.resources.Resource(ctx, report.ResourceID)
		if err != nil {
			return err
		}
		level := report.Level
		if in.Level != nil {
			level = *in.Level
		}
		status := StatusInvalid
		if in.Verdict == VerdictValid {
			status = StatusValid
			if report.Reason == ReasonMalware {
				level = LevelCritical
			}
		}
		if err := s.repo.Resolve(ctx, report.ID, Resolution{Status: status, Level: level, ProcessedBy: who.UserID, ProcessedAt: s.now(), Note: in.Note}); err != nil {
			return err
		}
		if status == StatusValid {
			if err := s.settleValid(ctx, who, report, level, resource.GameID, in.Note, notify); err != nil {
				return err
			}
		} else if err := s.settleInvalid(ctx, who, report, resource.GameID, in.Note, notify); err != nil {
			return err
		}
		if !remove {
			return nil
		}
		purge, err = s.resources.TakeDown(ctx, report.ResourceID)
		return err
	})
	if err != nil {
		return View{}, err
	}
	if err := s.resources.PurgeLater(ctx, purge); err != nil {
		return View{}, err
	}
	return s.repo.Get(ctx, id)
}

func (s *Service) settleValid(ctx context.Context, who actor.Actor, report Report, level Level, gameID int, note *string, notify bool) error {
	outcome, err := s.punishReported(ctx, who, report, level)
	if err != nil {
		return err
	}
	if err := s.repo.MarkReportedPenalty(ctx, report.ID, outcome.applied()); err != nil {
		return err
	}
	if !notify {
		return nil
	}
	if err := s.send(ctx, report.ReporterID, gameID, message.ToneSuccess, "Messages.System.Report.Valid", message.Meta{
		"reason":          report.Reason,
		"malicious_level": level,
		"process_note":    note,
	}); err != nil {
		return err
	}
	return s.send(ctx, report.ReportedUserID, gameID, message.ToneDestructive, "Messages.System.Report.Penalty", message.Meta{
		"reason":          report.Reason,
		"malicious_level": level,
		"ban_days":        outcome.banDays,
		"quota_sub_gb":    outcome.quotaBytes / GiB,
		"process_note":    note,
	})
}

func (s *Service) settleInvalid(ctx context.Context, who actor.Actor, report Report, gameID int, note *string, notify bool) error {
	outcome, err := s.punishReporter(ctx, who, report.ReporterID)
	if err != nil {
		return err
	}
	if err := s.repo.MarkReporterPenalty(ctx, report.ID, outcome.applied()); err != nil {
		return err
	}
	if !notify {
		return nil
	}
	return s.send(ctx, report.ReporterID, gameID, message.ToneWarning, "Messages.System.Report.Invalid", message.Meta{
		"false_report_count": outcome.count,
		"ban_days":           outcome.banDays,
		"quota_sub_gb":       outcome.quotaBytes / GiB,
		"process_note":       note,
	})
}

func (s *Service) punishReported(ctx context.Context, who actor.Actor, report Report, level Level) (penaltyOutcome, error) {
	target, found, err := s.repo.Member(ctx, report.ReportedUserID)
	if err != nil || !found || target.Role > RoleUser {
		return penaltyOutcome{}, err
	}
	policy := TargetPenalty(level)
	if policy.QuotaBytes > 0 {
		if _, err := s.quota.AdjustSize(ctx, target.ID, upload.ActionSub, policy.QuotaBytes, "REPORT_"+string(report.Reason)); err != nil {
			return penaltyOutcome{}, err
		}
	}
	outcome := penaltyOutcome{quotaBytes: policy.QuotaBytes}
	if policy.BanDays > 0 && target.Status != UserBanned {
		reviewer := who.UserID
		outcome.banApplied, err = s.banner.Ban(ctx, target.ID, &reviewer, "Resource report: "+string(report.Reason), policy.BanDays)
		if err != nil {
			return penaltyOutcome{}, err
		}
		if outcome.banApplied {
			outcome.banDays = policy.BanDays
		}
	}
	return outcome, nil
}

func (s *Service) punishReporter(ctx context.Context, who actor.Actor, reporterID int) (penaltyOutcome, error) {
	reporter, found, err := s.repo.Member(ctx, reporterID)
	if err != nil || !found || reporter.Role > RoleUser {
		return penaltyOutcome{}, err
	}
	count, err := s.repo.CountInvalidSince(ctx, reporterID, s.now().Add(-FalseReportWindow))
	if err != nil {
		return penaltyOutcome{}, err
	}
	outcome := penaltyOutcome{count: count}
	policy := FalseReportPenalty(count)
	if policy.QuotaBytes > 0 {
		outcome.quotaBytes, err = s.quota.AdjustSize(ctx, reporterID, upload.ActionSub, policy.QuotaBytes, falsePositiveQuotaReason)
		if err != nil {
			return penaltyOutcome{}, err
		}
	}
	if policy.BanDays > 0 && reporter.Status != UserBanned {
		reviewer := who.UserID
		reason := fmt.Sprintf("Malicious reports: %d in %d days", count, FalseReportWindowDays)
		outcome.banApplied, err = s.banner.Ban(ctx, reporterID, &reviewer, reason, policy.BanDays)
		if err != nil {
			return penaltyOutcome{}, err
		}
		if outcome.banApplied {
			outcome.banDays = policy.BanDays
		}
	}
	return outcome, nil
}

func (s *Service) send(ctx context.Context, receiverID, gameID int, tone message.Tone, key string, meta message.Meta) error {
	return s.messages.Send(ctx, message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       tone,
		Title:      key + ".Title",
		Content:    key + ".Content",
		GameID:     &gameID,
		Meta:       meta,
		ReceiverID: receiverID,
	})
}
