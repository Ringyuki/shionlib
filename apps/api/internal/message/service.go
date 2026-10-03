package message

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	repo     Repository
	notifier Notifier
	games    GameCards
	tx       Transactor
	now      func() time.Time
}

func NewService(repo Repository, notifier Notifier, games GameCards, tx Transactor, now func() time.Time) *Service {
	return &Service{repo: repo, notifier: notifier, games: games, tx: tx, now: now}
}

func (s *Service) Send(ctx context.Context, in NewMessage) error {
	if (in.Type == TypeCommentLike || in.Type == TypeCommentReply) && in.SenderID != nil && *in.SenderID == in.ReceiverID {
		return nil
	}
	if in.Tone == "" {
		in.Tone = ToneInfo
	}
	created, err := s.repo.Create(ctx, in)
	if err != nil {
		return err
	}
	s.tx.AfterCommit(ctx, func(ctx context.Context) {
		s.notifier.NewMessage(ctx, in.ReceiverID, Notice{ID: created.ID, Title: created.Title, Type: created.Type, Tone: created.Tone, Created: created.Created})
	})
	return nil
}

func (s *Service) List(ctx context.Context, who actor.Actor, filter Filter, page Page) ([]Message, int, error) {
	return s.repo.List(ctx, who.UserID, filter, page)
}

func (s *Service) UnreadCount(ctx context.Context, who actor.Actor) (int, error) {
	return s.repo.CountUnread(ctx, who.UserID)
}

func (s *Service) Open(ctx context.Context, who actor.Actor, id int) (Detail, error) {
	var stored Stored
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		var err error
		stored, err = s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		if stored.Receiver.ID != who.UserID {
			return ErrForbidden
		}
		if err := s.repo.MarkRead(ctx, id, who.UserID, s.now()); err != nil {
			return err
		}
		s.tx.AfterCommit(ctx, s.publishUnread(who.UserID))
		return nil
	})
	if err != nil {
		return Detail{}, err
	}
	detail := Detail{Message: stored.Message, Comment: stored.Comment}
	if stored.GameID != nil {
		cards, err := s.games.ByIDs(ctx, []int{*stored.GameID}, who)
		if err != nil {
			return Detail{}, err
		}
		if card, ok := cards[*stored.GameID]; ok {
			detail.Game = &card
		}
	}
	return detail, nil
}

func (s *Service) MarkRead(ctx context.Context, who actor.Actor, id int) error {
	if err := s.repo.MarkRead(ctx, id, who.UserID, s.now()); err != nil {
		return err
	}
	s.publishUnread(who.UserID)(ctx)
	return nil
}

func (s *Service) MarkAllRead(ctx context.Context, who actor.Actor) error {
	if err := s.repo.MarkAllRead(ctx, who.UserID, s.now()); err != nil {
		return err
	}
	s.notifier.Unread(ctx, who.UserID, 0)
	return nil
}

func (s *Service) MarkAllUnread(ctx context.Context, who actor.Actor) error {
	if err := s.repo.MarkAllUnread(ctx, who.UserID); err != nil {
		return err
	}
	s.publishUnread(who.UserID)(ctx)
	return nil
}

func (s *Service) publishUnread(userID int) func(context.Context) {
	return func(ctx context.Context) {
		count, err := s.repo.CountUnread(ctx, userID)
		if err != nil {
			return
		}
		s.notifier.Unread(ctx, userID, count)
	}
}
