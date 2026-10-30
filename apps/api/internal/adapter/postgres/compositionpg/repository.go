package compositionpg

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entcomposition "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

var facts = []string{
	entcomposition.FieldID, entcomposition.FieldGameID, entcomposition.FieldCreatorID, entcomposition.FieldResourceID, entcomposition.FieldTargetFileID,
	entcomposition.FieldBase, entcomposition.FieldPatch, entcomposition.FieldSave, entcomposition.FieldDetails, entcomposition.FieldGameDir, entcomposition.FieldPatchDir,
	entcomposition.FieldKeepPatch, entcomposition.FieldNote, entcomposition.FieldPatchMatch, entcomposition.FieldPlan, entcomposition.FieldState, entcomposition.FieldStep,
	entcomposition.FieldPercent, entcomposition.FieldRuns, entcomposition.FieldFailure, entcomposition.FieldFailureDetail, entcomposition.FieldOutputName,
	entcomposition.FieldOutputSize, entcomposition.FieldQueuedAt, entcomposition.FieldStartedAt, entcomposition.FieldFinishedAt, entcomposition.FieldCreated, entcomposition.FieldUpdated,
}

var entryColumns = map[composition.Role]string{composition.RolePatch: entcomposition.FieldPatchEntries, composition.RoleSave: entcomposition.FieldSaveEntries}

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Create(ctx context.Context, in composition.NewComposition) (composition.Composition, error) {
	base, err := encoded(baseOf(in.Base))
	if err != nil {
		return composition.Composition{}, err
	}
	details, err := encoded(detailsOf(in.Details))
	if err != nil {
		return composition.Composition{}, err
	}
	row, err := r.db(ctx).Composition.Create().
		SetGameID(in.GameID).
		SetCreatorID(in.CreatorID).
		SetNillableResourceID(in.ResourceID).
		SetNillableTargetFileID(in.TargetFileID).
		SetBase(base).
		SetDetails(details).
		SetNillableGameDir(in.Placement.GameDir).
		SetNillablePatchDir(in.Placement.PatchDir).
		SetKeepPatch(in.KeepPatch).
		SetNillableNote(in.Note).
		SetState(string(composition.StateDraft)).
		Save(ctx)
	if err != nil {
		return composition.Composition{}, fmt.Errorf("create composition: %w", err)
	}
	return toComposition(row)
}

func (r *Repository) read(ctx context.Context, id int, lock bool) (composition.Composition, error) {
	query := r.db(ctx).Composition.Query().Where(entcomposition.ID(id))
	if lock {
		query = query.ForUpdate()
	}
	row, err := query.Select(facts...).Only(ctx)
	if postgres.IsNotFound(err) {
		return composition.Composition{}, composition.ErrNotFound
	}
	if err != nil {
		return composition.Composition{}, fmt.Errorf("read composition %d: %w", id, err)
	}
	return toComposition(row)
}

func (r *Repository) Get(ctx context.Context, id int) (composition.Composition, error) {
	return r.read(ctx, id, false)
}

func (r *Repository) Lock(ctx context.Context, id int) (composition.Composition, error) {
	return r.read(ctx, id, true)
}

func (r *Repository) LockQueue(ctx context.Context) error {
	if _, err := r.db(ctx).ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended('composition/queue', 0))"); err != nil {
		return fmt.Errorf("lock the composition queue: %w", err)
	}
	return nil
}

func (r *Repository) Save(ctx context.Context, item composition.Composition) error {
	columns := map[string]any{"base": baseOf(item.Base), "patch": inputOf(item.Patch), "save": inputOf(item.Save), "details": detailsOf(item.Details), "plan": planOf(item.Plan), "runs": runsOf(item.Runs)}
	if item.Match != nil {
		columns["match"] = matchRecord{Translators: item.Match.Translators, Version: item.Match.Version, URL: item.Match.URL}
	}
	raw := map[string]json.RawMessage{}
	for name, value := range columns {
		column, err := encoded(value)
		if err != nil {
			return err
		}
		raw[name] = column
	}
	update := r.db(ctx).Composition.UpdateOneID(item.ID).
		SetBase(raw["base"]).
		SetPatch(raw["patch"]).
		SetSave(raw["save"]).
		SetDetails(raw["details"]).
		SetPlan(raw["plan"]).
		SetRuns(raw["runs"]).
		SetKeepPatch(item.KeepPatch).
		SetState(string(item.State)).
		SetPercent(item.Percent).
		SetOutputName(item.OutputName).
		SetUpdated(item.Updated.UTC())
	if match, ok := raw["match"]; ok {
		update.SetPatchMatch(match)
	} else {
		update.ClearPatchMatch()
	}
	nillable(update.SetResourceID, update.ClearResourceID, item.ResourceID)
	nillable(update.SetTargetFileID, update.ClearTargetFileID, item.TargetFileID)
	nillable(update.SetGameDir, update.ClearGameDir, item.Placement.GameDir)
	nillable(update.SetPatchDir, update.ClearPatchDir, item.Placement.PatchDir)
	nillable(update.SetNote, update.ClearNote, item.Note)
	nillable(update.SetStep, update.ClearStep, (*string)(item.Step))
	nillable(update.SetFailure, update.ClearFailure, (*string)(item.Failure))
	nillable(update.SetFailureDetail, update.ClearFailureDetail, item.FailureDetail)
	nillable(update.SetOutputSize, update.ClearOutputSize, item.OutputSize)
	nillable(update.SetQueuedAt, update.ClearQueuedAt, item.QueuedAt)
	nillable(update.SetStartedAt, update.ClearStartedAt, item.StartedAt)
	nillable(update.SetFinishedAt, update.ClearFinishedAt, item.FinishedAt)
	err := update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return composition.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("save composition %d: %w", item.ID, err)
	}
	return nil
}

func nillable[T any, U any](set func(T) U, clear func() U, value *T) {
	if value == nil {
		clear()
		return
	}
	set(*value)
}

func (r *Repository) SetProgress(ctx context.Context, id int, percent int) error {
	err := r.db(ctx).Composition.UpdateOneID(id).SetPercent(percent).Exec(ctx)
	if postgres.IsNotFound(err) {
		return composition.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("set the progress of composition %d: %w", id, err)
	}
	return nil
}

func (r *Repository) SetEntries(ctx context.Context, id int, role composition.Role, entries []composition.Entry) error {
	raw, err := encoded(entriesOf(entries))
	if err != nil {
		return err
	}
	update := r.db(ctx).Composition.UpdateOneID(id)
	if role == composition.RoleSave {
		update.SetSaveEntries(raw)
	} else {
		update.SetPatchEntries(raw)
	}
	err = update.Exec(ctx)
	if postgres.IsNotFound(err) {
		return composition.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("set the %s entries of composition %d: %w", role, id, err)
	}
	return nil
}

func (r *Repository) Entries(ctx context.Context, id int, role composition.Role) ([]composition.Entry, error) {
	row, err := r.db(ctx).Composition.Query().Where(entcomposition.ID(id)).Select(entryColumns[role]).Only(ctx)
	if postgres.IsNotFound(err) {
		return []composition.Entry{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read the %s entries of composition %d: %w", role, id, err)
	}
	raw := row.PatchEntries
	if role == composition.RoleSave {
		raw = row.SaveEntries
	}
	records, err := decoded[[]entryRecord](raw, "entries")
	if err != nil {
		return nil, err
	}
	entries := []composition.Entry{}
	if records != nil {
		for _, record := range *records {
			entries = append(entries, composition.Entry(record))
		}
	}
	return entries, nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Composition.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return composition.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete composition %d: %w", id, err)
	}
	return nil
}

func (r *Repository) list(ctx context.Context, action string, limit int, where ...predicate.Composition) ([]composition.Composition, error) {
	query := r.db(ctx).Composition.Query().Where(where...).Order(ent.Desc(entcomposition.FieldID))
	if limit > 0 {
		query = query.Limit(limit)
	}
	rows, err := query.Select(facts...).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", action, err)
	}
	found := make([]composition.Composition, len(rows))
	for i, row := range rows {
		if found[i], err = toComposition(row); err != nil {
			return nil, err
		}
	}
	return found, nil
}

func holds(column string) predicate.Composition {
	return func(s *sql.Selector) {
		s.Where(sql.P(func(b *sql.Builder) {
			b.WriteString("jsonb_typeof(").Ident(s.C(column)).WriteString(") = 'object'")
		}))
	}
}

func (r *Repository) ListActive(ctx context.Context, creatorID, limit int) ([]composition.Composition, error) {
	shown := entcomposition.Or(
		entcomposition.StateIn(string(composition.StateQueued), string(composition.StateRunning), string(composition.StateFailed)),
		entcomposition.And(
			entcomposition.State(string(composition.StateDraft)),
			entcomposition.Or(entcomposition.TargetFileIDNotNil(), holds(entcomposition.FieldPatch), holds(entcomposition.FieldSave)),
		),
	)
	return r.list(ctx, fmt.Sprintf("list the compositions of user %d", creatorID), limit, entcomposition.CreatorID(creatorID), shown)
}

func (r *Repository) OfResource(ctx context.Context, resourceID int) ([]composition.Composition, error) {
	return r.list(ctx, fmt.Sprintf("list the compositions of resource %d", resourceID), 0, entcomposition.ResourceID(resourceID))
}

func (r *Repository) Composed(ctx context.Context, resourceIDs []int) ([]int, error) {
	if len(resourceIDs) == 0 {
		return []int{}, nil
	}
	var composed []int
	err := r.db(ctx).Composition.Query().
		Where(entcomposition.ResourceIDIn(resourceIDs...)).
		Unique(true).
		Order(ent.Asc(entcomposition.FieldResourceID)).
		Select(entcomposition.FieldResourceID).
		Scan(ctx, &composed)
	if err != nil {
		return nil, fmt.Errorf("find composed resources: %w", err)
	}
	return append([]int{}, composed...), nil
}

func (r *Repository) count(ctx context.Context, state composition.State) (int, error) {
	count, err := r.db(ctx).Composition.Query().Where(entcomposition.State(string(state))).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count %s compositions: %w", state, err)
	}
	return count, nil
}

func (r *Repository) CountQueued(ctx context.Context) (int, error) {
	return r.count(ctx, composition.StateQueued)
}

func (r *Repository) CountRunning(ctx context.Context) (int, error) {
	return r.count(ctx, composition.StateRunning)
}

func (r *Repository) Ahead(ctx context.Context, id int) (int, error) {
	target, err := r.db(ctx).Composition.Query().Where(entcomposition.ID(id)).Select(entcomposition.FieldQueuedAt).Only(ctx)
	if postgres.IsNotFound(err) || (err == nil && target.QueuedAt == nil) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read the place of composition %d: %w", id, err)
	}
	earlier := entcomposition.And(
		entcomposition.State(string(composition.StateQueued)),
		entcomposition.IDNEQ(id),
		entcomposition.Or(
			entcomposition.QueuedAtLT(*target.QueuedAt),
			entcomposition.And(entcomposition.QueuedAtEQ(*target.QueuedAt), entcomposition.IDLT(id)),
		),
	)
	ahead, err := r.db(ctx).Composition.Query().Where(entcomposition.Or(entcomposition.State(string(composition.StateRunning)), earlier)).Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("count the compositions ahead of %d: %w", id, err)
	}
	return ahead, nil
}

func (r *Repository) StaleDrafts(ctx context.Context, before time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).Composition.Query().
		Where(entcomposition.State(string(composition.StateDraft)), entcomposition.UpdatedLT(before.UTC())).
		Order(ent.Asc(entcomposition.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stale composition drafts: %w", err)
	}
	return ids, nil
}

func (r *Repository) Unsettled(ctx context.Context, limit int) ([]composition.Composition, error) {
	reading := func(column string) predicate.Composition {
		return func(s *sql.Selector) {
			s.Where(sql.P(func(b *sql.Builder) {
				b.Ident(s.C(column)).WriteString("->>'state' = ").Arg(string(composition.InputReading))
			}))
		}
	}
	waiting := entcomposition.Or(
		entcomposition.StateIn(string(composition.StateQueued), string(composition.StateRunning)),
		entcomposition.And(entcomposition.State(string(composition.StateDraft)), entcomposition.Or(reading(entcomposition.FieldPatch), reading(entcomposition.FieldSave))),
	)
	rows, err := r.db(ctx).Composition.Query().Where(waiting).Order(ent.Asc(entcomposition.FieldID)).Limit(limit).Select(facts...).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list unsettled compositions: %w", err)
	}
	found := make([]composition.Composition, len(rows))
	for i, row := range rows {
		if found[i], err = toComposition(row); err != nil {
			return nil, err
		}
	}
	return found, nil
}

func (r *Repository) Existing(ctx context.Context, ids []int) ([]int, error) {
	if len(ids) == 0 {
		return []int{}, nil
	}
	existing, err := r.db(ctx).Composition.Query().Where(entcomposition.IDIn(ids...)).Order(byID).IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("find existing compositions: %w", err)
	}
	return existing, nil
}

func byID(s *sql.Selector) {
	s.OrderBy(s.C(entcomposition.FieldID))
}
