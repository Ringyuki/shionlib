package walkthroughpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entwalkthrough "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/walkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

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

func toWalkthrough(row *ent.Walkthrough) walkthrough.Walkthrough {
	return walkthrough.Walkthrough{
		ID:            row.ID,
		GameID:        row.GameID,
		Title:         row.Title,
		Content:       row.Content,
		HTML:          row.HTML,
		Lang:          row.Lang,
		Created:       row.Created,
		Updated:       row.Updated,
		Edited:        row.Edited,
		Status:        walkthrough.Status(row.Status),
		CreatorID:     row.CreatorID,
		ReviewPending: row.ReviewPending,
	}
}
