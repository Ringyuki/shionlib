package comment

import (
	"context"
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

type AdminService struct {
	repo       Repository
	store      AdminStore
	messages   Messages
	activities Activities
	queue      Queue
	tx         Transactor
}

func NewAdminService(repo Repository, store AdminStore, messages Messages, activities Activities, queue Queue, tx Transactor) *AdminService {
	return &AdminService{repo: repo, store: store, messages: messages, activities: activities, queue: queue, tx: tx}
}

func (s *AdminService) Search(ctx context.Context, filter AdminFilter, page Page) ([]AdminEntry, int, error) {
	return s.store.Search(ctx, filter, page)
}

func (s *AdminService) Detail(ctx context.Context, id int) (AdminDetail, error) {
	return s.store.Detail(ctx, id)
}

func (s *AdminService) SetStatus(ctx context.Context, who actor.Actor, id int, change StatusChange) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		existing, err := s.repo.Lock(ctx, id)
		if err != nil {
			return err
		}
		if existing.Status == change.Status {
			return nil
		}
		if err := s.repo.SetStatus(ctx, id, change.Status); err != nil {
			return err
		}
		switch change.Status {
		case StatusVisible:
			return s.publish(ctx, existing)
		case StatusBlocked:
			if change.Notify != nil && !*change.Notify {
				return nil
			}
			return s.messages.Send(ctx, moderation.CommentBlockMessage(moderation.CommentNotice{
				CommentID:       existing.ID,
				GameID:          existing.GameID,
				AuthorID:        existing.CreatorID,
				ModeratorUserID: &who.UserID,
			}, blockDetails(change)))
		}
		return nil
	})
}

func (s *AdminService) Rescan(ctx context.Context, id int) error {
	if err := s.repo.SetStatus(ctx, id, StatusPending); err != nil {
		return err
	}
	return s.queue.Enqueue(ctx, moderation.ScreenComment{CommentID: id})
}

func (s *AdminService) publish(ctx context.Context, existing Comment) error {
	recorded, err := s.store.HasActivity(ctx, existing.ID)
	if err != nil {
		return err
	}
	if !recorded {
		commentID, gameID := existing.ID, existing.GameID
		if err := s.activities.Record(ctx, activity.NewActivity{Type: activity.TypeComment, UserID: existing.CreatorID, GameID: &gameID, CommentID: &commentID}); err != nil {
			return err
		}
	}
	if existing.ParentID == nil {
		return nil
	}
	parent, err := s.repo.Get(ctx, *existing.ParentID)
	if err != nil || parent.CreatorID == existing.CreatorID {
		return ignoreMissing(err)
	}
	notified, err := s.store.HasReplyNotice(ctx, existing.ID, parent.CreatorID)
	if err != nil || notified {
		return err
	}
	return s.messages.Send(ctx, moderation.CommentReplyMessage(moderation.CommentNotice{
		CommentID:      existing.ID,
		GameID:         existing.GameID,
		AuthorID:       existing.CreatorID,
		ParentAuthorID: parent.CreatorID,
	}))
}

func blockDetails(change StatusChange) moderation.BlockDetails {
	details := moderation.BlockDetails{TopCategory: moderation.CategoryHarassment, Reason: change.Reason, Evidence: change.Evidence}
	if change.TopCategory != nil {
		details.TopCategory = *change.TopCategory
	}
	details.Reviewed = (change.Reason != nil && *change.Reason != "") || (change.Evidence != nil && *change.Evidence != "")
	return details
}

func ignoreMissing(err error) error {
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	return err
}
