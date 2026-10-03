package commentpg

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entactivity "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/activity"
	entcomment "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/comment"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	entmessage "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
)

var sortFields = map[comment.SortField]string{
	comment.SortByID:      entcomment.FieldID,
	comment.SortByCreated: entcomment.FieldCreated,
	comment.SortByUpdated: entcomment.FieldUpdated,
	comment.SortByStatus:  entcomment.FieldStatus,
}

func (r *Repository) Search(ctx context.Context, filter comment.AdminFilter, page comment.Page) ([]comment.AdminEntry, int, error) {
	query := r.db(ctx).Comment.Query()
	if filter.Status != nil {
		query.Where(entcomment.Status(int(*filter.Status)))
	}
	if filter.CreatorID != nil {
		query.Where(entcomment.CreatorID(*filter.CreatorID))
	}
	if filter.GameID != nil {
		query.Where(entcomment.GameID(*filter.GameID))
	}
	if keyword := strings.TrimSpace(filter.Search); keyword != "" {
		query.Where(entcomment.Or(searchPredicates(keyword)...))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count comments: %w", err)
	}
	field, ok := sortFields[filter.SortBy]
	if !ok {
		field = entcomment.FieldCreated
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	query.Select(listFields...)
	rows, err := withAdminEdges(query, false).
		Order(order(field), order(entcomment.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search comments: %w", err)
	}
	entries, err := r.adminEntries(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func (r *Repository) Detail(ctx context.Context, id int) (comment.AdminDetail, error) {
	rows, err := withAdminEdges(r.db(ctx).Comment.Query().Where(entcomment.ID(id)), true).All(ctx)
	if err != nil {
		return comment.AdminDetail{}, fmt.Errorf("load comment %d: %w", id, err)
	}
	if len(rows) == 0 {
		return comment.AdminDetail{}, comment.ErrNotFound
	}
	entries, err := r.adminEntries(ctx, rows)
	if err != nil {
		return comment.AdminDetail{}, err
	}
	detail := comment.AdminDetail{AdminEntry: entries[0], Moderations: make([]moderation.Event, len(rows[0].Edges.Moderates))}
	for i, event := range rows[0].Edges.Moderates {
		detail.Moderations[i] = moderationpg.ToEvent(event)
	}
	return detail, nil
}

func (r *Repository) HasActivity(ctx context.Context, commentID int) (bool, error) {
	exists, err := r.db(ctx).Activity.Query().Where(entactivity.CommentID(commentID), entactivity.TypeEQ(entactivity.TypeCOMMENT)).Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check comment activity: %w", err)
	}
	return exists, nil
}

func (r *Repository) HasReplyNotice(ctx context.Context, commentID, receiverID int) (bool, error) {
	exists, err := r.db(ctx).Message.Query().
		Where(entmessage.TypeEQ(entmessage.TypeCOMMENT_REPLY), entmessage.CommentID(commentID), entmessage.ReceiverID(receiverID)).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("check reply notice: %w", err)
	}
	return exists, nil
}

func searchPredicates(keyword string) []predicate.Comment {
	var predicates []predicate.Comment
	if id, ok := numericKeyword(keyword); ok {
		predicates = append(predicates, entcomment.ID(id), entcomment.CreatorID(id), entcomment.GameID(id))
	}
	return append(predicates,
		entcomment.HTMLContainsFold(keyword),
		entcomment.HasCreatorWith(entuser.Or(entuser.NameContainsFold(keyword), entuser.EmailContainsFold(keyword))),
		entcomment.HasGameWith(entgame.Or(entgame.TitleZhContainsFold(keyword), entgame.TitleEnContainsFold(keyword), entgame.TitleJpContainsFold(keyword))),
	)
}

func numericKeyword(keyword string) (int, bool) {
	if strings.TrimLeft(keyword, "0123456789") != "" {
		return 0, false
	}
	id, err := strconv.Atoi(keyword)
	if err != nil || id > math.MaxInt32 {
		return 0, false
	}
	return id, true
}

func withAdminEdges(query *ent.CommentQuery, allEvents bool) *ent.CommentQuery {
	return query.
		WithCreator(func(q *ent.UserQuery) { q.Select(slices.Concat(userpg.SummaryFields, []string{entuser.FieldEmail})...) }).
		WithParent(func(q *ent.CommentQuery) {
			q.Select(entcomment.FieldID, entcomment.FieldHTML, entcomment.FieldCreatorID).WithCreator(userpg.SelectSummary)
		}).
		WithGame(func(q *ent.GameQuery) {
			q.Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn)
		}).
		WithModerates(func(q *ent.ModerationEventQuery) {
			q.Order(ent.Desc(moderationevent.FieldCreatedAt), ent.Desc(moderationevent.FieldID))
			if !allEvents {
				q.Select(moderationevent.FieldID, moderationevent.FieldCommentID, moderationevent.FieldDecision, moderationevent.FieldModel,
					moderationevent.FieldTopCategory, moderationevent.FieldMaxScore, moderationevent.FieldReason, moderationevent.FieldEvidence, moderationevent.FieldCreatedAt)
			}
		})
}

func (r *Repository) adminEntries(ctx context.Context, rows []*ent.Comment) ([]comment.AdminEntry, error) {
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	counts := map[int]int{}
	if len(ids) > 0 {
		var err error
		if counts, err = r.likeCounts(ctx, ids); err != nil {
			return nil, err
		}
	}
	entries := make([]comment.AdminEntry, len(rows))
	for i, row := range rows {
		entry := comment.AdminEntry{
			Comment:   toComment(row),
			Creator:   userpg.ToSummary(row.Edges.Creator),
			Parent:    parentRef(row.Edges.Parent),
			LikeCount: counts[row.ID],
		}
		if row.Edges.Creator != nil {
			entry.CreatorEmail = row.Edges.Creator.Email
		}
		if g := row.Edges.Game; g != nil {
			entry.Game = comment.GameRef{ID: g.ID, TitleJP: g.TitleJp, TitleZH: g.TitleZh, TitleEN: g.TitleEn}
		}
		if len(row.Edges.Moderates) > 0 {
			latest := moderationpg.ToEvent(row.Edges.Moderates[0])
			entry.Moderation = &latest
		}
		entries[i] = entry
	}
	return entries, nil
}
