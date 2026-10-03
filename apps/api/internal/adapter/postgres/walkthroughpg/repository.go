package walkthroughpg

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/moderationevent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
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

const gameFK = "walkthroughs_game_id_fkey"

var summaryFields = []string{
	entwalkthrough.FieldID, entwalkthrough.FieldGameID, entwalkthrough.FieldTitle, entwalkthrough.FieldLang,
	entwalkthrough.FieldCreated, entwalkthrough.FieldUpdated, entwalkthrough.FieldEdited, entwalkthrough.FieldStatus,
	entwalkthrough.FieldCreatorID,
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

func (r *Repository) Get(ctx context.Context, id int) (walkthrough.Walkthrough, error) {
	row, err := r.db(ctx).Walkthrough.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return walkthrough.Walkthrough{}, walkthrough.ErrNotFound
	}
	if err != nil {
		return walkthrough.Walkthrough{}, fmt.Errorf("get walkthrough %d: %w", id, err)
	}
	return toWalkthrough(row), nil
}

func (r *Repository) Lock(ctx context.Context, id int) (walkthrough.Walkthrough, error) {
	row, err := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)).ForUpdate().Only(ctx)
	if postgres.IsNotFound(err) {
		return walkthrough.Walkthrough{}, walkthrough.ErrNotFound
	}
	if err != nil {
		return walkthrough.Walkthrough{}, fmt.Errorf("lock walkthrough %d: %w", id, err)
	}
	return toWalkthrough(row), nil
}

func (r *Repository) View(ctx context.Context, id int) (walkthrough.View, error) {
	row, err := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)).WithCreator(userpg.SelectSummary).Only(ctx)
	if postgres.IsNotFound(err) {
		return walkthrough.View{}, walkthrough.ErrNotFound
	}
	if err != nil {
		return walkthrough.View{}, fmt.Errorf("view walkthrough %d: %w", id, err)
	}
	return walkthrough.View{Walkthrough: toWalkthrough(row), Creator: userpg.ToSummary(row.Edges.Creator)}, nil
}

func (r *Repository) Create(ctx context.Context, in walkthrough.NewWalkthrough) (walkthrough.Walkthrough, error) {
	row, err := r.db(ctx).Walkthrough.Create().
		SetGameID(in.GameID).
		SetTitle(in.Title).
		SetContent(in.Content).
		SetHTML(in.HTML).
		SetNillableLang(in.Lang).
		SetStatus(entwalkthrough.Status(in.Status)).
		SetCreatorID(in.CreatorID).
		SetReviewPending(in.ReviewPending).
		Save(ctx)
	if postgres.IsForeignKeyViolation(err, gameFK) {
		return walkthrough.Walkthrough{}, game.ErrNotFound
	}
	if err != nil {
		return walkthrough.Walkthrough{}, fmt.Errorf("create walkthrough: %w", err)
	}
	return toWalkthrough(row), nil
}

func (r *Repository) Update(ctx context.Context, id int, changes walkthrough.Changes) error {
	update := r.db(ctx).Walkthrough.UpdateOneID(id).
		SetTitle(changes.Title).
		SetContent(changes.Content).
		SetHTML(changes.HTML).
		SetStatus(entwalkthrough.Status(changes.Status)).
		SetReviewPending(changes.ReviewPending).
		SetEdited(true)
	if changes.Lang != nil {
		update.SetLang(*changes.Lang)
	} else {
		update.ClearLang()
	}
	return r.exec(ctx, id, update)
}

func (r *Repository) SetStatus(ctx context.Context, id int, status walkthrough.Status) error {
	return r.exec(ctx, id, r.db(ctx).Walkthrough.UpdateOneID(id).SetStatus(entwalkthrough.Status(status)).SetReviewPending(false))
}

func (r *Repository) MarkReviewPending(ctx context.Context, id int) error {
	return r.exec(ctx, id, r.db(ctx).Walkthrough.UpdateOneID(id).SetReviewPending(true))
}

func (r *Repository) exec(ctx context.Context, id int, update *ent.WalkthroughUpdateOne) error {
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return walkthrough.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("update walkthrough %d: %w", id, err)
	}
	return nil
}

func (r *Repository) ListByGame(ctx context.Context, filter walkthrough.GameFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	query := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.GameID(filter.GameID))
	if filter.Status != nil {
		query.Where(entwalkthrough.StatusEQ(entwalkthrough.Status(*filter.Status)))
	}
	public := statuses(filter.Public)
	if filter.ViewerID == 0 {
		query.Where(entwalkthrough.StatusIn(public...))
	} else {
		query.Where(
			entwalkthrough.StatusNEQ(entwalkthrough.StatusDELETED),
			entwalkthrough.Or(entwalkthrough.StatusIn(public...), entwalkthrough.CreatorID(filter.ViewerID)),
		)
	}
	return r.list(ctx, query, page)
}

func (r *Repository) ListByCreator(ctx context.Context, filter walkthrough.CreatorFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	query := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.CreatorID(filter.CreatorID), entwalkthrough.StatusIn(statuses(filter.Statuses)...))
	if filter.ExcludeRated {
		query.Where(entwalkthrough.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	return r.list(ctx, query, page)
}

func (r *Repository) list(ctx context.Context, query *ent.WalkthroughQuery, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count walkthroughs: %w", err)
	}
	query.Select(summaryFields...)
	rows, err := query.
		WithCreator(userpg.SelectSummary).
		Order(ent.Desc(entwalkthrough.FieldCreated), ent.Desc(entwalkthrough.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list walkthroughs: %w", err)
	}
	summaries := make([]walkthrough.Summary, len(rows))
	for i, row := range rows {
		summaries[i] = walkthrough.Summary{
			ID:      row.ID,
			GameID:  row.GameID,
			Title:   row.Title,
			Lang:    row.Lang,
			Created: row.Created,
			Updated: row.Updated,
			Edited:  row.Edited,
			Status:  walkthrough.Status(row.Status),
			Creator: userpg.ToSummary(row.Edges.Creator),
		}
	}
	return summaries, total, nil
}

func statuses(values []walkthrough.Status) []entwalkthrough.Status {
	out := make([]entwalkthrough.Status, len(values))
	for i, value := range values {
		out[i] = entwalkthrough.Status(value)
	}
	return out
}
