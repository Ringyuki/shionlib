package walkthroughpg

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

var sortFields = map[walkthrough.SortField]string{
	walkthrough.SortByID:      entwalkthrough.FieldID,
	walkthrough.SortByTitle:   entwalkthrough.FieldTitle,
	walkthrough.SortByCreated: entwalkthrough.FieldCreated,
	walkthrough.SortByUpdated: entwalkthrough.FieldUpdated,
	walkthrough.SortByStatus:  entwalkthrough.FieldStatus,
}

var adminFields = []string{
	entwalkthrough.FieldID, entwalkthrough.FieldGameID, entwalkthrough.FieldTitle, entwalkthrough.FieldHTML, entwalkthrough.FieldLang,
	entwalkthrough.FieldCreated, entwalkthrough.FieldUpdated, entwalkthrough.FieldEdited, entwalkthrough.FieldStatus,
	entwalkthrough.FieldCreatorID,
}

func (r *Repository) Search(ctx context.Context, filter walkthrough.AdminFilter, page walkthrough.Page) ([]walkthrough.AdminEntry, int, error) {
	query := r.db(ctx).Walkthrough.Query()
	if filter.Status != nil {
		query.Where(entwalkthrough.StatusEQ(entwalkthrough.Status(*filter.Status)))
	}
	if filter.CreatorID != nil {
		query.Where(entwalkthrough.CreatorID(*filter.CreatorID))
	}
	if filter.GameID != nil {
		query.Where(entwalkthrough.GameID(*filter.GameID))
	}
	if keyword := strings.TrimSpace(filter.Search); keyword != "" {
		query.Where(entwalkthrough.Or(searchPredicates(keyword)...))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count walkthroughs: %w", err)
	}
	field, ok := sortFields[filter.SortBy]
	if !ok {
		field = entwalkthrough.FieldCreated
	}
	order := ent.Asc
	if filter.Descending {
		order = ent.Desc
	}
	query.Select(adminFields...)
	rows, err := withAdminEdges(query, false).
		Order(order(field), order(entwalkthrough.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search walkthroughs: %w", err)
	}
	entries := make([]walkthrough.AdminEntry, len(rows))
	for i, row := range rows {
		entries[i] = toAdminEntry(row)
	}
	return entries, total, nil
}

func (r *Repository) Detail(ctx context.Context, id int) (walkthrough.AdminDetail, error) {
	rows, err := withAdminEdges(r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)), true).All(ctx)
	if err != nil {
		return walkthrough.AdminDetail{}, fmt.Errorf("load walkthrough %d: %w", id, err)
	}
	if len(rows) == 0 {
		return walkthrough.AdminDetail{}, walkthrough.ErrNotFound
	}
	detail := walkthrough.AdminDetail{AdminEntry: toAdminEntry(rows[0]), Moderations: make([]moderation.Event, len(rows[0].Edges.Moderates))}
	for i, event := range rows[0].Edges.Moderates {
		detail.Moderations[i] = moderationpg.ToEvent(event)
	}
	return detail, nil
}

func searchPredicates(keyword string) []predicate.Walkthrough {
	var predicates []predicate.Walkthrough
	if strings.TrimLeft(keyword, "0123456789") == "" {
		if id, err := strconv.Atoi(keyword); err == nil && id <= math.MaxInt32 {
			predicates = append(predicates, entwalkthrough.ID(id), entwalkthrough.CreatorID(id), entwalkthrough.GameID(id))
		}
	}
	return append(predicates,
		entwalkthrough.TitleContainsFold(keyword),
		entwalkthrough.HTMLContainsFold(keyword),
		entwalkthrough.HasCreatorWith(entuser.Or(entuser.NameContainsFold(keyword), entuser.EmailContainsFold(keyword))),
		entwalkthrough.HasGameWith(entgame.Or(entgame.TitleZhContainsFold(keyword), entgame.TitleEnContainsFold(keyword), entgame.TitleJpContainsFold(keyword))),
	)
}

func withAdminEdges(query *ent.WalkthroughQuery, allEvents bool) *ent.WalkthroughQuery {
	return query.
		WithCreator(func(q *ent.UserQuery) { q.Select(slices.Concat(userpg.SummaryFields, []string{entuser.FieldEmail})...) }).
		WithGame(func(q *ent.GameQuery) {
			q.Select(entgame.FieldID, entgame.FieldTitleJp, entgame.FieldTitleZh, entgame.FieldTitleEn)
		}).
		WithModerates(func(q *ent.ModerationEventQuery) {
			q.Order(ent.Desc(moderationevent.FieldCreatedAt), ent.Desc(moderationevent.FieldID))
			if !allEvents {
				q.Select(moderationevent.FieldID, moderationevent.FieldWalkthroughID, moderationevent.FieldDecision, moderationevent.FieldModel,
					moderationevent.FieldTopCategory, moderationevent.FieldMaxScore, moderationevent.FieldReason, moderationevent.FieldEvidence, moderationevent.FieldCreatedAt)
			}
		})
}

func toAdminEntry(row *ent.Walkthrough) walkthrough.AdminEntry {
	entry := walkthrough.AdminEntry{Walkthrough: toWalkthrough(row), Creator: userpg.ToSummary(row.Edges.Creator)}
	if row.Edges.Creator != nil {
		entry.CreatorEmail = row.Edges.Creator.Email
	}
	if g := row.Edges.Game; g != nil {
		entry.Game = walkthrough.GameRef{ID: g.ID, TitleJP: g.TitleJp, TitleZH: g.TitleZh, TitleEN: g.TitleEn}
	}
	if len(row.Edges.Moderates) > 0 {
		latest := moderationpg.ToEvent(row.Edges.Moderates[0])
		entry.Moderation = &latest
	}
	return entry
}
