package walkthrough

import (
	"context"
	"slices"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
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

type CreateInput struct {
	GameID  int
	Title   string
	Content lexical.Document
	Status  Status
}

func (s *Service) Create(ctx context.Context, who actor.Actor, in CreateInput) (View, error) {
	exists, err := s.games.Exists(ctx, in.GameID)
	if err != nil {
		return View{}, err
	}
	if !exists {
		return View{}, game.ErrNotFound
	}
	html, err := render(in.Content)
	if err != nil {
		return View{}, err
	}
	var id int
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		created, err := s.repo.Create(ctx, NewWalkthrough{
			GameID:        in.GameID,
			Title:         in.Title,
			Content:       in.Content.Raw(),
			HTML:          html,
			Lang:          DetectLanguage("", in.Content.Text()).Stored(),
			Status:        heldForReview(in.Status),
			CreatorID:     who.UserID,
			ReviewPending: in.Status == StatusPublished,
		})
		if err != nil {
			return err
		}
		id = created.ID
		gameID := in.GameID
		return s.activities.Record(ctx, activity.NewActivity{Type: activity.TypeWalkthroughCreate, UserID: who.UserID, GameID: &gameID, WalkthroughID: &id})
	})
	if err != nil {
		return View{}, err
	}
	if err := s.requestReview(ctx, id, in.Status); err != nil {
		return View{}, err
	}
	return s.repo.View(ctx, id)
}

type UpdateInput struct {
	Title   string
	Content lexical.Document
	Status  Status
}

func (s *Service) Update(ctx context.Context, who actor.Actor, id int, in UpdateInput) (View, error) {
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.managed(ctx, who, id); err != nil {
			return err
		}
		html, err := render(in.Content)
		if err != nil {
			return err
		}
		return s.repo.Update(ctx, id, Changes{
			Title:         in.Title,
			Content:       in.Content.Raw(),
			HTML:          html,
			Lang:          DetectLanguage(in.Title, in.Content.Text()).Stored(),
			Status:        heldForReview(in.Status),
			ReviewPending: in.Status == StatusPublished,
		})
	})
	if err != nil {
		return View{}, err
	}
	if err := s.requestReview(ctx, id, in.Status); err != nil {
		return View{}, err
	}
	return s.repo.View(ctx, id)
}

func (s *Service) Get(ctx context.Context, viewer actor.Actor, id int, withContent bool) (View, error) {
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
	if !withContent {
		view.Content = nil
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

func (s *Service) ListByGame(ctx context.Context, viewer actor.Actor, gameID int, status *Status, page Page) ([]Summary, int, error) {
	filter := GameFilter{GameID: gameID, Status: status, Public: []Status{StatusPublished}}
	if viewer.Authenticated() {
		filter.ViewerID = viewer.UserID
		if viewer.AtLeast(actor.RoleAdmin) {
			filter.Public = []Status{StatusPublished, StatusDraft}
		}
	}
	return s.repo.ListByGame(ctx, filter, page)
}

func (s *Service) ListByCreator(ctx context.Context, viewer actor.Actor, creatorID int, status *Status, page Page) ([]Summary, int, error) {
	visible := []Status{StatusPublished}
	if creatorID == viewer.UserID {
		visible = []Status{StatusPublished, StatusDraft, StatusHidden}
	}
	if status != nil && slices.Contains(visible, *status) {
		visible = []Status{*status}
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

func (s *Service) requestReview(ctx context.Context, id int, requested Status) error {
	if requested != StatusPublished {
		return nil
	}
	return s.queue.Enqueue(ctx, moderation.ReviewWalkthrough{WalkthroughID: id})
}

func heldForReview(requested Status) Status {
	if requested == StatusPublished {
		return StatusHidden
	}
	return requested
}

func render(content lexical.Document) (string, error) {
	html := content.HTML()
	if utf8.RuneCountInString(html) > MaxHTMLLength {
		return "", ErrContentTooLong
	}
	return html, nil
}
