package commentpg

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entcomment "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/commentlike"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const (
	gameFK        = "comments_game_id_fkey"
	parentFK      = "comments_parent_id_fkey"
	rootFK        = "comments_root_id_fkey"
	likeCommentFK = "comment_likes_comment_id_fkey"
)

var listFields = []string{
	entcomment.FieldID, entcomment.FieldHTML, entcomment.FieldGameID, entcomment.FieldParentID, entcomment.FieldRootID,
	entcomment.FieldReplyCount, entcomment.FieldCreatorID, entcomment.FieldStatus, entcomment.FieldEdited,
	entcomment.FieldCreated, entcomment.FieldUpdated,
}

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Get(ctx context.Context, id int) (comment.Comment, error) {
	row, err := r.db(ctx).Comment.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return comment.Comment{}, comment.ErrNotFound
	}
	if err != nil {
		return comment.Comment{}, fmt.Errorf("get comment %d: %w", id, err)
	}
	return toComment(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (comment.Comment, error) {
	row, err := r.db(ctx).Comment.Query().Where(entcomment.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return comment.Comment{}, comment.ErrNotFound
	}
	if err != nil {
		return comment.Comment{}, fmt.Errorf("lock comment %d: %w", id, err)
	}
	return toComment(row), nil
}

func (r *Repository) Create(ctx context.Context, in comment.NewComment) (comment.Comment, error) {
	row, err := r.db(ctx).Comment.Create().
		SetContent(in.Content).
		SetHTML(in.HTML).
		SetGameID(in.GameID).
		SetCreatorID(in.CreatorID).
		SetNillableParentID(in.ParentID).
		SetNillableRootID(in.RootID).
		SetStatus(int(comment.StatusPending)).
		Save(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, gameFK):
		return comment.Comment{}, game.ErrNotFound
	case postgres.IsForeignKeyViolation(err, parentFK), postgres.IsForeignKeyViolation(err, rootFK):
		return comment.Comment{}, comment.ErrNotFound
	case err != nil:
		return comment.Comment{}, fmt.Errorf("create comment: %w", err)
	}
	return toComment(row), nil
}

func (r *Repository) SetRoot(ctx context.Context, id, rootID int) error {
	return r.updateOne(ctx, id, r.db(ctx).Comment.UpdateOneID(id).SetRootID(rootID))
}

func (r *Repository) AdjustReplyCount(ctx context.Context, id, delta int) error {
	update := r.db(ctx).Comment.Update().Where(entcomment.ID(id))
	if delta < 0 {
		update.Where(entcomment.ReplyCountGTE(-delta))
	}
	if err := update.AddReplyCount(delta).Exec(ctx); err != nil {
		return fmt.Errorf("adjust reply count of comment %d: %w", id, err)
	}
	return nil
}

func (r *Repository) UpdateContent(ctx context.Context, id int, content json.RawMessage, html string) error {
	return r.updateOne(ctx, id, r.db(ctx).Comment.UpdateOneID(id).
		SetContent(content).
		SetHTML(html).
		SetEdited(true).
		SetStatus(int(comment.StatusPending)))
}

func (r *Repository) SetStatus(ctx context.Context, id int, status comment.Status) error {
	return r.updateOne(ctx, id, r.db(ctx).Comment.UpdateOneID(id).SetStatus(int(status)))
}

func (r *Repository) updateOne(ctx context.Context, id int, update *ent.CommentUpdateOne) error {
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return comment.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update comment %d: %w", id, err)
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Comment.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return comment.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete comment %d: %w", id, err)
	}
	return nil
}

func (r *Repository) Entry(ctx context.Context, id, viewerID int) (comment.Entry, error) {
	rows, err := withThread(r.db(ctx).Comment.Query().Where(entcomment.ID(id))).All(ctx)
	if err != nil {
		return comment.Entry{}, fmt.Errorf("load comment %d: %w", id, err)
	}
	if len(rows) == 0 {
		return comment.Entry{}, comment.ErrNotFound
	}
	entries, err := r.entries(ctx, rows, viewerID)
	if err != nil {
		return comment.Entry{}, err
	}
	return entries[0], nil
}

func (r *Repository) ListByGame(ctx context.Context, gameID, viewerID int, page comment.Page) ([]comment.Entry, int, error) {
	query := r.db(ctx).Comment.Query().Where(entcomment.GameID(gameID), entcomment.Or(
		entcomment.Status(int(comment.StatusVisible)),
		entcomment.And(entcomment.CreatorID(viewerID), entcomment.StatusNEQ(int(comment.StatusBlocked))),
	))
	return r.list(ctx, query, viewerID, page, ent.Asc(entcomment.FieldCreated), ent.Asc(entcomment.FieldID))
}

func (r *Repository) ListByCreator(ctx context.Context, filter comment.CreatorFilter, page comment.Page) ([]comment.Entry, int, error) {
	query := r.db(ctx).Comment.Query().Where(entcomment.CreatorID(filter.CreatorID), entcomment.Status(int(comment.StatusVisible)))
	if filter.ExcludeRated {
		query.Where(entcomment.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	return r.list(ctx, query, filter.ViewerID, page, ent.Desc(entcomment.FieldCreated), ent.Desc(entcomment.FieldID))
}

func (r *Repository) list(ctx context.Context, query *ent.CommentQuery, viewerID int, page comment.Page, order ...entcomment.OrderOption) ([]comment.Entry, int, error) {
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count comments: %w", err)
	}
	query.Select(listFields...)
	rows, err := withThread(query).
		Order(order...).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list comments: %w", err)
	}
	entries, err := r.entries(ctx, rows, viewerID)
	if err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func withThread(query *ent.CommentQuery) *ent.CommentQuery {
	return query.
		WithCreator(userpg.SelectSummary).
		WithParent(func(q *ent.CommentQuery) {
			q.Select(entcomment.FieldID, entcomment.FieldHTML, entcomment.FieldCreatorID).WithCreator(userpg.SelectSummary)
		})
}

func (r *Repository) entries(ctx context.Context, rows []*ent.Comment, viewerID int) ([]comment.Entry, error) {
	entries := make([]comment.Entry, len(rows))
	if len(rows) == 0 {
		return entries, nil
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	counts, err := r.likeCounts(ctx, ids)
	if err != nil {
		return nil, err
	}
	liked := map[int]bool{}
	if viewerID > 0 {
		likedIDs, err := r.db(ctx).CommentLike.Query().
			Where(commentlike.CommentIDIn(ids...), commentlike.UserID(viewerID)).
			Select(commentlike.FieldCommentID).
			Ints(ctx)
		if err != nil {
			return nil, fmt.Errorf("load liked comments: %w", err)
		}
		for _, id := range likedIDs {
			liked[id] = true
		}
	}
	for i, row := range rows {
		entries[i] = comment.Entry{
			Comment:   toComment(row),
			Creator:   userpg.ToSummary(row.Edges.Creator),
			Parent:    parentRef(row.Edges.Parent),
			LikeCount: counts[row.ID],
			Liked:     liked[row.ID],
		}
	}
	return entries, nil
}

func (r *Repository) likeCounts(ctx context.Context, ids []int) (map[int]int, error) {
	var counts []struct {
		CommentID int `json:"comment_id"`
		Count     int `json:"count"`
	}
	err := r.db(ctx).CommentLike.Query().
		Where(commentlike.CommentIDIn(ids...)).
		GroupBy(commentlike.FieldCommentID).
		Aggregate(ent.Count()).
		Scan(ctx, &counts)
	if err != nil {
		return nil, fmt.Errorf("count comment likes: %w", err)
	}
	byID := make(map[int]int, len(counts))
	for _, c := range counts {
		byID[c.CommentID] = c.Count
	}
	return byID, nil
}

func (r *Repository) HasLike(ctx context.Context, commentID, userID int) (bool, error) {
	exists, err := r.db(ctx).CommentLike.Query().Where(commentlike.CommentID(commentID), commentlike.UserID(userID)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check comment like: %w", err)
	}
	return exists, nil
}

func (r *Repository) AddLike(ctx context.Context, commentID, userID int) (bool, error) {
	result, err := r.db(ctx).ExecContext(ctx,
		`INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT (comment_id, user_id) DO NOTHING`,
		commentID, userID)
	if postgres.IsForeignKeyViolation(err, likeCommentFK) {
		return false, comment.ErrNotFound
	}
	if err != nil {
		return false, fmt.Errorf("like comment %d: %w", commentID, err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("like comment %d: %w", commentID, err)
	}
	return affected == 1, nil
}

func (r *Repository) RemoveLike(ctx context.Context, commentID, userID int) error {
	if _, err := r.db(ctx).CommentLike.Delete().Where(commentlike.CommentID(commentID), commentlike.UserID(userID)).Exec(ctx); err != nil {
		return fmt.Errorf("unlike comment %d: %w", commentID, err)
	}
	return nil
}

func toComment(row *ent.Comment) comment.Comment {
	return comment.Comment{
		ID:         row.ID,
		Content:    row.Content,
		HTML:       row.HTML,
		GameID:     row.GameID,
		ParentID:   row.ParentID,
		RootID:     row.RootID,
		ReplyCount: row.ReplyCount,
		CreatorID:  row.CreatorID,
		Status:     comment.Status(row.Status),
		Edited:     row.Edited,
		Created:    row.Created,
		Updated:    row.Updated,
	}
}

func parentRef(row *ent.Comment) *comment.ParentRef {
	if row == nil {
		return nil
	}
	return &comment.ParentRef{ID: row.ID, HTML: row.HTML, Creator: userpg.ToSummary(row.Edges.Creator)}
}
