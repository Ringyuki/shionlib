package comment

import (
	"context"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type Service struct {
	repo     Repository
	games    GameCards
	messages Messages
	queue    Queue
	tx       Transactor
}

func NewService(repo Repository, games GameCards, messages Messages, queue Queue, tx Transactor) *Service {
	return &Service{repo: repo, games: games, messages: messages, queue: queue, tx: tx}
}

func (s *Service) Create(ctx context.Context, who actor.Actor, gameID int, in CreateInput) (Entry, error) {
	html, err := render(in.Content)
	if err != nil {
		return Entry{}, err
	}
	parentID := in.ParentID
	if parentID != nil && *parentID == 0 {
		parentID = nil
	}
	var id int
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		var rootID *int
		if parentID != nil {
			parent, err := s.repo.Get(ctx, *parentID)
			if err != nil {
				return err
			}
			if parent.GameID != gameID {
				return ErrNotFound
			}
			root := parent.ID
			if parent.RootID != nil {
				root = *parent.RootID
			}
			rootID = &root
		}
		created, err := s.repo.Create(ctx, NewComment{
			Content:   in.Content.Raw(),
			HTML:      html,
			GameID:    gameID,
			CreatorID: who.UserID,
			ParentID:  parentID,
			RootID:    rootID,
		})
		if err != nil {
			return err
		}
		id = created.ID
		if rootID == nil {
			return s.repo.SetRoot(ctx, created.ID, created.ID)
		}
		if err := s.repo.AdjustReplyCount(ctx, *parentID, 1); err != nil {
			return err
		}
		if *rootID != *parentID {
			return s.repo.AdjustReplyCount(ctx, *rootID, 1)
		}
		return nil
	})
	if err != nil {
		return Entry{}, err
	}
	if err := s.queue.Enqueue(ctx, moderation.ScreenComment{CommentID: id}); err != nil {
		return Entry{}, err
	}
	return s.repo.Entry(ctx, id, who.UserID)
}

func (s *Service) Edit(ctx context.Context, who actor.Actor, id int, content lexical.Document) (Entry, error) {
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.managed(ctx, who, id, true); err != nil {
			return err
		}
		html, err := render(content)
		if err != nil {
			return err
		}
		return s.repo.UpdateContent(ctx, id, content.Raw(), html)
	})
	if err != nil {
		return Entry{}, err
	}
	if err := s.queue.Enqueue(ctx, moderation.ScreenComment{CommentID: id}); err != nil {
		return Entry{}, err
	}
	return s.repo.Entry(ctx, id, who.UserID)
}

func (s *Service) Raw(ctx context.Context, who actor.Actor, id int) (Comment, error) {
	return s.managed(ctx, who, id, false)
}

func (s *Service) Delete(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		existing, err := s.managed(ctx, who, id, true)
		if err != nil {
			return err
		}
		if err := s.repo.Delete(ctx, id); err != nil {
			return err
		}
		if existing.ParentID != nil {
			if err := s.repo.AdjustReplyCount(ctx, *existing.ParentID, -1); err != nil {
				return err
			}
		}
		if root := existing.RootID; root != nil && *root != existing.ID && (existing.ParentID == nil || *root != *existing.ParentID) {
			return s.repo.AdjustReplyCount(ctx, *root, -1)
		}
		return nil
	})
}

func (s *Service) ListByGame(ctx context.Context, viewer actor.Actor, gameID int, page Page) ([]Entry, int, error) {
	return s.repo.ListByGame(ctx, gameID, viewer.UserID, page)
}

func (s *Service) ListByCreator(ctx context.Context, viewer actor.Actor, creatorID int, page Page) ([]Entry, int, error) {
	entries, total, err := s.repo.ListByCreator(ctx, CreatorFilter{
		CreatorID:    creatorID,
		ViewerID:     viewer.UserID,
		ExcludeRated: !viewer.IncludesRated(),
	}, page)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, len(entries))
	for i, entry := range entries {
		ids[i] = entry.GameID
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	for i, entry := range entries {
		card, ok := cards[entry.GameID]
		if !ok {
			card = game.Card{ID: entry.GameID}
		}
		entries[i].Game = &card
	}
	return entries, total, nil
}

func (s *Service) ToggleLike(ctx context.Context, who actor.Actor, id int) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.repo.Get(ctx, id)
		if err != nil {
			return err
		}
		liked, err := s.repo.HasLike(ctx, id, who.UserID)
		if err != nil {
			return err
		}
		if liked {
			return s.repo.RemoveLike(ctx, id, who.UserID)
		}
		added, err := s.repo.AddLike(ctx, id, who.UserID)
		if err != nil || !added {
			return err
		}
		return s.messages.Send(ctx, likeMessage(target, who.UserID))
	})
}

func (s *Service) managed(ctx context.Context, who actor.Actor, id int, lock bool) (Comment, error) {
	get := s.repo.Get
	if lock {
		get = s.repo.Lock
	}
	existing, err := get(ctx, id)
	if err != nil {
		return Comment{}, err
	}
	if existing.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return Comment{}, ErrNotOwner
	}
	return existing, nil
}

func render(content lexical.Document) (string, error) {
	html := content.HTML()
	if utf8.RuneCountInString(html) > MaxHTMLLength {
		return "", ErrContentTooLong
	}
	return html, nil
}

func likeMessage(target Comment, senderID int) message.NewMessage {
	commentID, gameID := target.ID, target.GameID
	return message.NewMessage{
		Type:       message.TypeCommentLike,
		Tone:       message.ToneInfo,
		Title:      "Messages.Comment.Like.Title",
		Content:    "Messages.Comment.Like.Content",
		ReceiverID: target.CreatorID,
		CommentID:  &commentID,
		GameID:     &gameID,
		SenderID:   &senderID,
	}
}
