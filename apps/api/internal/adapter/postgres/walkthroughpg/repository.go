package walkthroughpg

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"

	"entgo.io/ent/dialect/sql"

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
	walkthrough.SortByCreated: entwalkthrough.FieldCreated,
	walkthrough.SortByUpdated: entwalkthrough.FieldUpdated,
	walkthrough.SortByStatus:  entwalkthrough.FieldStatus,
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
		if entries[i], err = toAdminEntry(row); err != nil {
			return nil, 0, err
		}
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
	entry, err := toAdminEntry(rows[0])
	if err != nil {
		return walkthrough.AdminDetail{}, err
	}
	detail := walkthrough.AdminDetail{AdminEntry: entry, Moderations: make([]moderation.Event, len(rows[0].Edges.Moderates))}
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
		entwalkthrough.TextContainsFold(keyword),
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

const (
	gameFK     = "walkthroughs_game_id_fkey"
	writtenKey = "walkthroughs_game_id_creator_id_key"
)

var summaryFields = []string{
	entwalkthrough.FieldID, entwalkthrough.FieldGameID, entwalkthrough.FieldLang, entwalkthrough.FieldCreated, entwalkthrough.FieldUpdated,
	entwalkthrough.FieldStatus, entwalkthrough.FieldCreatorID, entwalkthrough.FieldReviewPending,
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
	return r.one(ctx, r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)))
}

func (r *Repository) Lock(ctx context.Context, id int) (walkthrough.Walkthrough, error) {
	return r.one(ctx, r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)).ForUpdate())
}

func (r *Repository) LockWritten(ctx context.Context, gameID, creatorID int) (walkthrough.Walkthrough, error) {
	return r.one(ctx, r.db(ctx).Walkthrough.Query().Where(written(gameID, creatorID)).ForUpdate())
}

func (r *Repository) one(ctx context.Context, query *ent.WalkthroughQuery) (walkthrough.Walkthrough, error) {
	row, err := query.Only(ctx)
	if postgres.IsNotFound(err) {
		return walkthrough.Walkthrough{}, walkthrough.ErrNotFound
	}
	if err != nil {
		return walkthrough.Walkthrough{}, fmt.Errorf("load walkthrough: %w", err)
	}
	return toWalkthrough(row)
}

func (r *Repository) View(ctx context.Context, id int) (walkthrough.View, error) {
	row, err := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.ID(id)).WithCreator(userpg.SelectSummary).Only(ctx)
	if postgres.IsNotFound(err) {
		return walkthrough.View{}, walkthrough.ErrNotFound
	}
	if err != nil {
		return walkthrough.View{}, fmt.Errorf("view walkthrough %d: %w", id, err)
	}
	stored, err := toWalkthrough(row)
	if err != nil {
		return walkthrough.View{}, err
	}
	return walkthrough.View{Walkthrough: stored, Creator: userpg.ToSummary(row.Edges.Creator)}, nil
}

func (r *Repository) Create(ctx context.Context, in walkthrough.NewWalkthrough) (walkthrough.Walkthrough, error) {
	routes, err := encodeRoutes(in.Routes)
	if err != nil {
		return walkthrough.Walkthrough{}, err
	}
	create := r.db(ctx).Walkthrough.Create().
		SetGameID(in.GameID).
		SetRoutes(routes).
		SetText(in.Text).
		SetNillableLang(in.Lang).
		SetStatus(entwalkthrough.Status(in.Status)).
		SetCreatorID(in.CreatorID).
		SetReviewPending(in.ReviewPending)
	if in.Note != nil {
		create.SetNote(in.Note)
	}
	row, err := create.Save(ctx)
	switch {
	case postgres.IsForeignKeyViolation(err, gameFK):
		return walkthrough.Walkthrough{}, game.ErrNotFound
	case postgres.IsUniqueViolation(err, writtenKey):
		return walkthrough.Walkthrough{}, walkthrough.ErrAlreadyWritten
	case err != nil:
		return walkthrough.Walkthrough{}, fmt.Errorf("create walkthrough: %w", err)
	}
	return toWalkthrough(row)
}

func (r *Repository) Update(ctx context.Context, id int, changes walkthrough.Changes) error {
	routes, err := encodeRoutes(changes.Routes)
	if err != nil {
		return err
	}
	update := r.db(ctx).Walkthrough.UpdateOneID(id).
		SetRoutes(routes).
		SetText(changes.Text).
		SetStatus(entwalkthrough.Status(changes.Status)).
		SetReviewPending(changes.ReviewPending).
		SetEdited(true)
	if changes.Note != nil {
		update.SetNote(changes.Note)
	} else {
		update.ClearNote()
	}
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

func (r *Repository) Written(ctx context.Context, gameID, creatorID int) (walkthrough.Summary, error) {
	summaries, err := r.summaries(ctx, r.db(ctx).Walkthrough.Query().Where(written(gameID, creatorID)))
	if err != nil {
		return walkthrough.Summary{}, err
	}
	if len(summaries) == 0 {
		return walkthrough.Summary{}, walkthrough.ErrNotFound
	}
	return summaries[0], nil
}

func (r *Repository) ListPublished(ctx context.Context, gameID, limit int) ([]walkthrough.Summary, error) {
	query := r.db(ctx).Walkthrough.Query().
		Where(entwalkthrough.GameID(gameID), entwalkthrough.StatusEQ(entwalkthrough.StatusPUBLISHED)).
		Order(ent.Desc(entwalkthrough.FieldUpdated), ent.Desc(entwalkthrough.FieldID)).
		Limit(limit)
	return r.summaries(ctx, query)
}

func (r *Repository) ListByCreator(ctx context.Context, filter walkthrough.CreatorFilter, page walkthrough.Page) ([]walkthrough.Summary, int, error) {
	query := r.db(ctx).Walkthrough.Query().Where(entwalkthrough.CreatorID(filter.CreatorID), entwalkthrough.StatusIn(statuses(filter.Statuses)...))
	if filter.ExcludeRated {
		query.Where(entwalkthrough.HasGameWith(gamepg.SafeForStrictViewers()))
	}
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count walkthroughs: %w", err)
	}
	query.Order(unpublishedFirst, ent.Desc(entwalkthrough.FieldUpdated), ent.Desc(entwalkthrough.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size)
	summaries, err := r.summaries(ctx, query)
	return summaries, total, err
}

func (r *Repository) summaries(ctx context.Context, query *ent.WalkthroughQuery) ([]walkthrough.Summary, error) {
	query.Select(summaryFields...)
	query.Modify(func(s *sql.Selector) {
		s.AppendSelectExprAs(sql.ExprFunc(func(b *sql.Builder) {
			b.WriteString("jsonb_array_length(").Ident(s.C(entwalkthrough.FieldRoutes)).WriteString(")")
		}), routeCount)
	})
	rows, err := query.WithCreator(userpg.SelectSummary).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list walkthroughs: %w", err)
	}
	summaries := make([]walkthrough.Summary, len(rows))
	for i, row := range rows {
		if summaries[i], err = toSummary(row); err != nil {
			return nil, err
		}
	}
	return summaries, nil
}

func written(gameID, creatorID int) predicate.Walkthrough {
	return entwalkthrough.And(entwalkthrough.GameID(gameID), entwalkthrough.CreatorID(creatorID), entwalkthrough.StatusNEQ(entwalkthrough.StatusDELETED))
}

func unpublishedFirst(s *sql.Selector) {
	s.OrderExpr(sql.ExprFunc(func(b *sql.Builder) {
		b.Ident(s.C(entwalkthrough.FieldStatus)).WriteString(" = ").Arg(string(entwalkthrough.StatusPUBLISHED))
	}))
}

func statuses(values []walkthrough.Status) []entwalkthrough.Status {
	out := make([]entwalkthrough.Status, len(values))
	for i, value := range values {
		out[i] = entwalkthrough.Status(value)
	}
	return out
}
