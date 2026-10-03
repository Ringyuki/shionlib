package moderationpg

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entcomment "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const (
	eventCommentFK     = "moderation_events_comment_id_fkey"
	eventWalkthroughFK = "moderation_events_walkthrough_id_fkey"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func selectTitles(q *ent.GameQuery) {
	q.Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn)
}

func (r *Repository) CommentSubject(ctx context.Context, id int) (moderation.CommentSubject, error) {
	return r.commentSubject(ctx, id, false)
}

func (r *Repository) LockCommentSubject(ctx context.Context, id int) (moderation.CommentSubject, error) {
	return r.commentSubject(ctx, id, true)
}

func (r *Repository) commentSubject(ctx context.Context, id int, lock bool) (moderation.CommentSubject, error) {
	query := r.db(ctx).Comment.Query().
		Where(entcomment.ID(id)).
		WithGame(selectTitles).
		WithParent(func(q *ent.CommentQuery) {
			q.Select(entcomment.FieldID, entcomment.FieldHTML, entcomment.FieldCreatorID)
		})
	if lock {
		query.ForUpdate()
	}
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return moderation.CommentSubject{}, moderation.ErrSubjectNotFound
	}
	if err != nil {
		return moderation.CommentSubject{}, fmt.Errorf("load comment %d for moderation: %w", id, err)
	}
	subject := moderation.CommentSubject{
		ID:        row.ID,
		CreatorID: row.CreatorID,
		GameID:    row.GameID,
		HTML:      deref(row.HTML),
		Pending:   comment.Status(row.Status) == comment.StatusPending,
		ParentID:  row.ParentID,
		Game:      titles(row.Edges.Game),
	}
	if parent := row.Edges.Parent; parent != nil {
		creatorID := parent.CreatorID
		subject.ParentCreatorID = &creatorID
		subject.ParentHTML = deref(parent.HTML)
	}
	return subject, nil
}

func (r *Repository) ApproveComment(ctx context.Context, id int) error {
	return r.setCommentStatus(ctx, id, comment.StatusVisible)
}

func (r *Repository) BlockComment(ctx context.Context, id int) error {
	return r.setCommentStatus(ctx, id, comment.StatusBlocked)
}

func (r *Repository) setCommentStatus(ctx context.Context, id int, status comment.Status) error {
	err := r.db(ctx).Comment.UpdateOneID(id).SetStatus(int(status)).Exec(ctx)
	if postgres.IsNotFound(err) {
		return moderation.ErrSubjectNotFound
	}
	if err != nil {
		return fmt.Errorf("set comment %d status: %w", id, err)
	}
	return nil
}

func (r *Repository) WalkthroughSubject(ctx context.Context, id int) (moderation.WalkthroughSubject, error) {
	return r.walkthroughSubject(ctx, id, false)
}

func (r *Repository) LockWalkthroughSubject(ctx context.Context, id int) (moderation.WalkthroughSubject, error) {
	return r.walkthroughSubject(ctx, id, true)
}

func (r *Repository) walkthroughSubject(ctx context.Context, id int, lock bool) (moderation.WalkthroughSubject, error) {
	query := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)).WithGame(selectTitles)
	if lock {
		query.ForUpdate()
	}
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return moderation.WalkthroughSubject{}, moderation.ErrSubjectNotFound
	}
	if err != nil {
		return moderation.WalkthroughSubject{}, fmt.Errorf("load walkthrough %d for moderation: %w", id, err)
	}
	return moderation.WalkthroughSubject{
		ID:            row.ID,
		CreatorID:     row.CreatorID,
		GameID:        row.GameID,
		Title:         row.Title,
		HTML:          row.HTML,
		Deleted:       walkthrough.Status(row.Status) == walkthrough.StatusDeleted,
		ReviewPending: row.ReviewPending,
		Game:          titles(row.Edges.Game),
	}, nil
}

func (r *Repository) PublishWalkthrough(ctx context.Context, id int) error {
	err := r.db(ctx).Walkthrough.Update().
		Where(entwalkthrough.ID(id), entwalkthrough.ReviewPending(true), entwalkthrough.StatusIn(entwalkthrough.StatusPUBLISHED, entwalkthrough.StatusHIDDEN)).
		SetStatus(entwalkthrough.StatusPUBLISHED).
		SetReviewPending(false).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("publish walkthrough %d: %w", id, err)
	}
	return nil
}

func (r *Repository) HideWalkthrough(ctx context.Context, id int) error {
	err := r.db(ctx).Walkthrough.Update().
		Where(entwalkthrough.ID(id), entwalkthrough.StatusNEQ(entwalkthrough.StatusDELETED)).
		SetStatus(entwalkthrough.StatusHIDDEN).
		SetReviewPending(false).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("hide walkthrough %d: %w", id, err)
	}
	return nil
}

func (r *Repository) PendingComments(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).Comment.Query().
		Where(entcomment.Status(int(comment.StatusPending)), entcomment.UpdatedLT(updatedBefore.UTC())).
		Order(ent.Asc(entcomment.FieldUpdated), ent.Asc(entcomment.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pending comments: %w", err)
	}
	return ids, nil
}

func (r *Repository) PendingWalkthroughReviews(ctx context.Context, updatedBefore time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).Walkthrough.Query().
		Where(
			entwalkthrough.ReviewPending(true),
			entwalkthrough.StatusNEQ(entwalkthrough.StatusDELETED),
			entwalkthrough.UpdatedLT(updatedBefore.UTC()),
		).
		Order(ent.Asc(entwalkthrough.FieldUpdated), ent.Asc(entwalkthrough.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pending walkthrough reviews: %w", err)
	}
	return ids, nil
}

func (r *Repository) RecordEvent(ctx context.Context, in moderation.NewEvent) error {
	categories := in.Categories
	if len(categories) == 0 {
		categories = json.RawMessage(`{}`)
	}
	create := r.db(ctx).ModerationEvent.Create().
		SetAuditBy(int(in.Auditor)).
		SetModel(in.Model).
		SetDecision(moderationevent.Decision(in.Decision)).
		SetTopCategory(moderationevent.TopCategory(in.TopCategory)).
		SetCategoriesJSON(categories).
		SetNillableReason(in.Reason).
		SetNillableEvidence(in.Evidence).
		SetNillableCommentID(in.CommentID).
		SetNillableWalkthroughID(in.WalkthroughID)
	if len(in.Scores) > 0 {
		create.SetScoresJSON(in.Scores)
	}
	if in.MaxScore != nil {
		create.SetMaxScore(strconv.FormatFloat(*in.MaxScore, 'f', 5, 64))
	}
	err := create.Exec(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, eventCommentFK), postgres.IsForeignKeyViolation(err, eventWalkthroughFK):
		return moderation.ErrSubjectNotFound
	case err != nil:
		return fmt.Errorf("record moderation event: %w", err)
	}
	return nil
}

func titles(row *ent.Game) moderation.GameTitles {
	if row == nil {
		return moderation.GameTitles{}
	}
	return moderation.GameTitles{JP: row.TitleJp, ZH: row.TitleZh, EN: row.TitleEn}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
