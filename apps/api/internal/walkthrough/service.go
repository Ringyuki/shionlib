package walkthrough

import (
	"context"
	"errors"
	"slices"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type Service struct {
	repo       Repository
	games      GameCards
	activities Activities
	queue      Queue
	tx         Transactor
}

func NewService(repo Repository, games GameCards, activities Activities, queue Queue, tx Transactor) *Service {
	return &Service{repo: repo, games: games, activities: activities, queue: queue, tx: tx}
}

func (s *Service) Write(ctx context.Context, who actor.Actor, in WriteInput) (View, error) {
	exists, err := s.games.Exists(ctx, in.GameID)
	if err != nil {
		return View{}, err
	}
	if !exists {
		return View{}, game.ErrNotFound
	}
	written, err := compose(in)
	if err != nil {
		return View{}, err
	}
	var id int
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		existing, err := s.repo.LockWritten(ctx, in.GameID, who.UserID)
		if errors.Is(err, ErrNotFound) {
			id, err = s.start(ctx, who, in.GameID, written)
			return err
		}
		if err != nil {
			return err
		}
		id = existing.ID
		return s.repo.Update(ctx, id, written)
	})
	if err != nil {
		return View{}, err
	}
	if in.Publish {
		if err := s.queue.Enqueue(ctx, moderation.ReviewWalkthrough{WalkthroughID: id}); err != nil {
			return View{}, err
		}
	}
	return s.repo.View(ctx, id)
}

func (s *Service) Get(ctx context.Context, viewer actor.Actor, id int) (View, error) {
	view, err := s.repo.View(ctx, id)
	if err != nil {
		return View{}, err
	}
	if view.Status == StatusDeleted {
		return View{}, ErrNotFound
	}
	if view.Status != StatusPublished && view.CreatorID != viewer.UserID && !viewer.AtLeast(actor.RoleAdmin) {
		return View{}, ErrNotOwner
	}
	return view, nil
}

func (s *Service) Delete(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.managed(ctx, who, id); err != nil {
			return err
		}
		return s.repo.SetStatus(ctx, id, StatusDeleted)
	})
}

func (s *Service) ListByGame(ctx context.Context, viewer actor.Actor, gameID int) ([]Summary, error) {
	published, err := s.repo.ListPublished(ctx, gameID, GameListLimit)
	if err != nil || !viewer.Authenticated() {
		return published, err
	}
	own, err := s.repo.Written(ctx, gameID, viewer.UserID)
	if errors.Is(err, ErrNotFound) {
		return published, nil
	}
	if err != nil {
		return nil, err
	}
	others := slices.DeleteFunc(published, func(summary Summary) bool { return summary.ID == own.ID })
	return append([]Summary{own}, others...), nil
}

func (s *Service) ListByCreator(ctx context.Context, viewer actor.Actor, creatorID int, page Page) ([]Summary, int, error) {
	visible := []Status{StatusPublished}
	if creatorID == viewer.UserID {
		visible = []Status{StatusPublished, StatusDraft, StatusHidden}
	}
	summaries, total, err := s.repo.ListByCreator(ctx, CreatorFilter{CreatorID: creatorID, Statuses: visible, ExcludeRated: !viewer.IncludesRated()}, page)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, len(summaries))
	for i, summary := range summaries {
		ids[i] = summary.GameID
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	for i, summary := range summaries {
		card, ok := cards[summary.GameID]
		if !ok {
			card = game.Card{ID: summary.GameID}
		}
		summaries[i].Game = &card
	}
	return summaries, total, nil
}

func (s *Service) start(ctx context.Context, who actor.Actor, gameID int, written Changes) (int, error) {
	created, err := s.repo.Create(ctx, NewWalkthrough{
		GameID:        gameID,
		Note:          written.Note,
		Routes:        written.Routes,
		Text:          written.Text,
		Lang:          written.Lang,
		Status:        written.Status,
		CreatorID:     who.UserID,
		ReviewPending: written.ReviewPending,
	})
	if err != nil {
		return 0, err
	}
	id := created.ID
	return id, s.activities.Record(ctx, activity.NewActivity{Type: activity.TypeWalkthroughCreate, UserID: who.UserID, GameID: &gameID, WalkthroughID: &id})
}

func (s *Service) managed(ctx context.Context, who actor.Actor, id int) (Walkthrough, error) {
	existing, err := s.repo.Lock(ctx, id)
	if err != nil {
		return Walkthrough{}, err
	}
	if existing.Status == StatusDeleted {
		return Walkthrough{}, ErrNotFound
	}
	if existing.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return Walkthrough{}, ErrNotOwner
	}
	return existing, nil
}

func compose(in WriteInput) (Changes, error) {
	routes := Tidy(in.Routes)
	written := Changes{Routes: routes, Status: StatusDraft}
	said := ""
	if in.Note != nil {
		written.Note, said = in.Note.Raw(), in.Note.Text()
	}
	if in.Publish {
		if err := Publishable(in.Note != nil, routes); err != nil {
			return Changes{}, err
		}
		written.Status, written.ReviewPending = StatusHidden, true
	}
	written.Text = Text(said, routes)
	if utf8.RuneCountInString(written.Text) > MaxTextLength {
		return Changes{}, ErrContentTooLong
	}
	written.Lang = DetectLanguage(written.Text).Stored()
	return written, nil
}
