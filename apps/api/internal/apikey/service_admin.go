package apikey

import (
	"context"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type AdminService struct {
	repo     Repository
	usage    UsageStore
	messages Messenger
	tx       Transactor
	settings setting.Source
	now      func() time.Time
}

func NewAdminService(deps Deps) *AdminService {
	return &AdminService{repo: deps.Repo, usage: deps.Usage, messages: deps.Messages, tx: deps.Tx, settings: deps.Settings, now: deps.Now}
}

func (s *AdminService) Summary(ctx context.Context) (Summary, error) {
	today := DayOf(s.now())
	summary, err := s.usage.Summary(ctx, today, today.AddDate(0, 0, 1-RecentDays))
	if err != nil {
		return Summary{}, err
	}
	summary.Enabled = Enabled.Read(s.settings)
	return summary, nil
}

func (s *AdminService) Days(ctx context.Context, count int) ([]Day, error) {
	today := DayOf(s.now())
	days, err := s.usage.Days(ctx, today.AddDate(0, 0, 1-count), nil)
	if err != nil {
		return nil, err
	}
	return filled(days, today, count), nil
}

func (s *AdminService) List(ctx context.Context, filter Filter, page paging.Page) ([]Listed, int, error) {
	filter.Since = DayOf(s.now()).AddDate(0, 0, 1-RecentDays)
	filter.Query = strings.TrimSpace(filter.Query)
	return s.usage.List(ctx, filter, page)
}

func (s *AdminService) Detail(ctx context.Context, id int) (Detail, error) {
	today := DayOf(s.now())
	detail, err := s.usage.Detail(ctx, id, today.AddDate(0, 0, 1-DetailDays))
	if err != nil {
		return Detail{}, err
	}
	detail.Days = filled(detail.Days, today, DetailDays)
	return detail, nil
}

func (s *AdminService) Suspend(ctx context.Context, admin actor.Actor, id int, reason string) error {
	reason = strings.TrimSpace(reason)
	now := s.now()
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		key, err := s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		if err := s.repo.SetSuspended(ctx, id, &reason, &now, &admin.UserID); err != nil {
			return err
		}
		return s.notify(ctx, key, "Suspended", message.ToneWarning, message.Meta{"name": key.Name, "prefix": key.Prefix, "reason": reason})
	})
}

func (s *AdminService) Restore(ctx context.Context, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		key, err := s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		if !key.Suspended() {
			return nil
		}
		if err := s.repo.SetSuspended(ctx, id, nil, nil, nil); err != nil {
			return err
		}
		return s.notify(ctx, key, "Restored", message.ToneSuccess, message.Meta{"name": key.Name, "prefix": key.Prefix})
	})
}

func (s *AdminService) SetAccountLimit(ctx context.Context, userID int, limit *int) error {
	return s.repo.SetAccountLimit(ctx, userID, limit)
}

func (s *AdminService) notify(ctx context.Context, key Key, event string, tone message.Tone, meta message.Meta) error {
	name := "Messages.System.APIKey." + event
	link := "/user/settings/api-keys"
	text := name + ".LinkText"
	meta["key_id"] = key.ID
	return s.messages.Send(ctx, message.NewMessage{
		Type:       message.TypeSystem,
		Tone:       tone,
		Title:      name + ".Title",
		Content:    name + ".Content",
		LinkText:   &text,
		LinkURL:    &link,
		Meta:       meta,
		ReceiverID: key.UserID,
	})
}
