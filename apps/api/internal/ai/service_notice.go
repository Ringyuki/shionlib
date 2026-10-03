package ai

import (
	"context"
	"errors"
)

type NoticeService struct {
	repo      Repository
	messenger Messenger
}

func NewNoticeService(repo Repository, messenger Messenger) *NoticeService {
	return &NoticeService{repo: repo, messenger: messenger}
}

func (s *NoticeService) Announce(ctx context.Context, notice RouteStatusNotice) error {
	route, err := s.repo.GetRoute(ctx, notice.RouteID)
	if errors.Is(err, ErrRouteNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if notice.Suspended != (route.Status == RouteSuspended) {
		return nil
	}
	admins, err := s.repo.SuperAdminIDs(ctx)
	if err != nil {
		return err
	}
	for _, admin := range admins {
		if err := s.messenger.Send(ctx, routeStatusMessage(route, notice.Suspended, admin)); err != nil {
			return err
		}
	}
	return nil
}
