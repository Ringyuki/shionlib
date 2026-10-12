package catalogpg

import (
	"context"
	"fmt"
	"time"
	"unicode/utf8"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsynccursor"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

func unlinked(source string, entity catalog.Entity) func(*sql.Selector) {
	return func(selector *sql.Selector) {
		links := sql.Table(catalogsourcelink.Table)
		selector.Where(sql.NotExists(
			sql.Select(links.C(catalogsourcelink.FieldID)).From(links).Where(sql.And(
				sql.ColumnsEQ(links.C(catalogsourcelink.FieldLocalID), selector.C("id")),
				sql.EQ(links.C(catalogsourcelink.FieldSource), source),
				sql.EQ(links.C(catalogsourcelink.FieldEntity), string(entity)),
			)),
		))
	}
}

func equalOrNull[P ~func(*sql.Selector)](column string, value *string) P {
	return func(selector *sql.Selector) {
		if value == nil {
			selector.Where(sql.IsNull(selector.C(column)))
			return
		}
		selector.Where(sql.EQ(selector.C(column), *value))
	}
}

func firstNonNil(values ...*string) *string {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func (s *Store) linked(ctx context.Context, ref catalog.Ref, exists func(context.Context, int) (bool, error)) (int, bool, bool, error) {
	link, err := s.link(ctx, ref)
	if err != nil || link == nil {
		return 0, false, false, err
	}
	found, err := exists(ctx, link.LocalID)
	if err != nil {
		return 0, false, false, fmt.Errorf("check linked %s: %w", ref.Entity, err)
	}
	if found {
		return link.LocalID, link.SyncedAt != nil, true, nil
	}
	return 0, false, false, s.dropLink(ctx, link.ID)
}

func setOrClear[T any, B any](value *T, set func(T) B, clear func() B) {
	if value != nil {
		set(*value)
		return
	}
	clear()
}

const (
	gameStatusHidden = 2
	maxErrorLength   = 500
	maxTitleLength   = 255
)

type Store struct {
	client *ent.Client
}

func NewStore(client *ent.Client) *Store {
	return &Store{client: client}
}

func (s *Store) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *Store) link(ctx context.Context, ref catalog.Ref) (*ent.CatalogSourceLink, error) {
	row, err := s.db(ctx).CatalogSourceLink.Query().
		Where(
			catalogsourcelink.Source(ref.Source),
			catalogsourcelink.Entity(string(ref.Entity)),
			catalogsourcelink.ExternalID(ref.ExternalID),
		).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load source link: %w", err)
	}
	return row, nil
}

func (s *Store) LocalID(ctx context.Context, ref catalog.Ref) (int, bool, error) {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return 0, false, err
	}
	return row.LocalID, true, nil
}

func (s *Store) saveLink(ctx context.Context, ref catalog.Ref, localID int, revision string, at time.Time) error {
	create := s.db(ctx).CatalogSourceLink.Create().
		SetSource(ref.Source).
		SetEntity(string(ref.Entity)).
		SetExternalID(ref.ExternalID).
		SetLocalID(localID).
		SetSyncedAt(at).
		SetFailures(0)
	if revision != "" {
		create.SetRevision(revision)
	}
	err := create.
		OnConflict(sql.ConflictColumns(catalogsourcelink.FieldSource, catalogsourcelink.FieldEntity, catalogsourcelink.FieldExternalID)).
		Update(func(u *ent.CatalogSourceLinkUpsert) {
			u.SetLocalID(localID)
			u.SetSyncedAt(at)
			u.SetFailures(0)
			u.ClearLastError()
			u.ClearMissingAt()
			if revision != "" {
				u.SetRevision(revision)
			}
			u.SetUpdated(at)
		}).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("save source link: %w", err)
	}
	return nil
}

func (s *Store) lockRef(ctx context.Context, ref catalog.Ref) error {
	key := ref.Source + "/" + string(ref.Entity) + "/" + ref.ExternalID
	if _, err := s.db(ctx).ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", key); err != nil {
		return fmt.Errorf("lock %s: %w", key, err)
	}
	return nil
}

func (s *Store) insertLink(ctx context.Context, ref catalog.Ref, localID int) (int, error) {
	err := s.db(ctx).CatalogSourceLink.Create().
		SetSource(ref.Source).
		SetEntity(string(ref.Entity)).
		SetExternalID(ref.ExternalID).
		SetLocalID(localID).
		Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("insert source link: %w", err)
	}
	return localID, nil
}

func (s *Store) dropLink(ctx context.Context, id int) error {
	if err := s.db(ctx).CatalogSourceLink.DeleteOneID(id).Exec(ctx); err != nil && !postgres.IsNotFound(err) {
		return fmt.Errorf("drop stale source link: %w", err)
	}
	return nil
}

func (s *Store) MarkMissing(ctx context.Context, ref catalog.Ref, hide bool, at time.Time) error {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return err
	}
	if err := s.db(ctx).CatalogSourceLink.UpdateOneID(row.ID).SetMissingAt(at).SetUpdated(at).Exec(ctx); err != nil {
		return fmt.Errorf("mark source link missing: %w", err)
	}
	if hide && ref.Entity == catalog.EntityGame {
		if err := s.db(ctx).Game.Update().Where(entgame.ID(row.LocalID)).SetStatus(gameStatusHidden).Exec(ctx); err != nil {
			return fmt.Errorf("hide game removed at source: %w", err)
		}
	}
	return nil
}

func (s *Store) Exclude(ctx context.Context, entity catalog.Entity, localID int, by catalog.Exclusion, at time.Time) error {
	update := s.db(ctx).CatalogSourceLink.Update().
		Where(catalogsourcelink.Entity(string(entity)), catalogsourcelink.LocalID(localID)).
		SetExcludedAt(at).
		SetUpdated(at)
	if title := []rune(by.Title); len(title) > 0 {
		update.SetTitle(string(title[:min(len(title), maxTitleLength)]))
	}
	if by.UserID != 0 {
		update.SetExcludedBy(by.UserID)
	}
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("exclude source links: %w", err)
	}
	return nil
}

func (s *Store) Include(ctx context.Context, ref catalog.Ref) error {
	err := s.db(ctx).CatalogSourceLink.Update().
		Where(
			catalogsourcelink.Source(ref.Source),
			catalogsourcelink.Entity(string(ref.Entity)),
			catalogsourcelink.ExternalID(ref.ExternalID),
			catalogsourcelink.ExcludedAtNotNil(),
		).
		ClearExcludedAt().
		ClearExcludedBy().
		ClearTitle().
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("include source link: %w", err)
	}
	return nil
}

func (s *Store) ExcludedEntries(ctx context.Context, offset, limit int) ([]catalog.ExcludedEntry, int, error) {
	query := s.db(ctx).CatalogSourceLink.Query().Where(catalogsourcelink.ExcludedAtNotNil())
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count excluded source links: %w", err)
	}
	rows, err := query.
		Order(ent.Desc(catalogsourcelink.FieldExcludedAt), ent.Desc(catalogsourcelink.FieldID)).
		Offset(offset).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list excluded source links: %w", err)
	}
	var removers []int
	for _, row := range rows {
		if row.ExcludedBy != nil {
			removers = append(removers, *row.ExcludedBy)
		}
	}
	names := map[int]string{}
	if len(removers) > 0 {
		users, err := s.db(ctx).User.Query().Where(entuser.IDIn(removers...)).Select(entuser.FieldID, entuser.FieldName).All(ctx)
		if err != nil {
			return nil, 0, fmt.Errorf("load who excluded source links: %w", err)
		}
		for _, user := range users {
			names[user.ID] = user.Name
		}
	}
	entries := make([]catalog.ExcludedEntry, len(rows))
	for i, row := range rows {
		entries[i] = toExcludedEntry(row, names)
	}
	return entries, total, nil
}

func (s *Store) LinkCounts(ctx context.Context, source string) (catalog.LinkCounts, error) {
	var rows []struct {
		Entity string `json:"entity"`
		Count  int    `json:"count"`
	}
	err := s.db(ctx).CatalogSourceLink.Query().
		Where(catalogsourcelink.Source(source), catalogsourcelink.ExcludedAtIsNil()).
		GroupBy(catalogsourcelink.FieldEntity).
		Aggregate(ent.Count()).
		Scan(ctx, &rows)
	if err != nil {
		return catalog.LinkCounts{}, fmt.Errorf("count source links: %w", err)
	}
	var counts catalog.LinkCounts
	for _, row := range rows {
		switch catalog.Entity(row.Entity) {
		case catalog.EntityGame:
			counts.Games = row.Count
		case catalog.EntityDeveloper:
			counts.Developers = row.Count
		case catalog.EntityCharacter:
			counts.Characters = row.Count
		}
	}
	return counts, nil
}

func (s *Store) Excluded(ctx context.Context, ref catalog.Ref) (bool, error) {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return false, err
	}
	return row.ExcludedAt != nil, nil
}

func (s *Store) Links(ctx context.Context, source string, entity catalog.Entity, externalIDs []string) (map[string]catalog.SourceLink, error) {
	links := make(map[string]catalog.SourceLink, len(externalIDs))
	if len(externalIDs) == 0 {
		return links, nil
	}
	rows, err := s.db(ctx).CatalogSourceLink.Query().
		Where(
			catalogsourcelink.Source(source),
			catalogsourcelink.Entity(string(entity)),
			catalogsourcelink.ExternalIDIn(externalIDs...),
		).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load source links: %w", err)
	}
	for _, row := range rows {
		links[row.ExternalID] = catalog.SourceLink{LocalID: row.LocalID, Excluded: row.ExcludedAt != nil}
	}
	return links, nil
}

func (s *Store) RecordFailure(ctx context.Context, ref catalog.Ref, reason string, at time.Time) error {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return err
	}
	if utf8.RuneCountInString(reason) > maxErrorLength {
		reason = string([]rune(reason)[:maxErrorLength])
	}
	if err := s.db(ctx).CatalogSourceLink.UpdateOneID(row.ID).AddFailures(1).SetLastError(reason).SetUpdated(at).Exec(ctx); err != nil {
		return fmt.Errorf("record source failure: %w", err)
	}
	return nil
}

func (s *Store) Stale(ctx context.Context, source string, before time.Time, limit int) ([]catalog.Ref, error) {
	rows, err := s.db(ctx).CatalogSourceLink.Query().
		Where(
			catalogsourcelink.Source(source),
			catalogsourcelink.MissingAtIsNil(),
			catalogsourcelink.ExcludedAtIsNil(),
			catalogsourcelink.Or(catalogsourcelink.SyncedAtIsNil(), catalogsourcelink.SyncedAtLT(before)),
		).
		Order(func(sel *sql.Selector) {
			sel.OrderExpr(sql.Expr(sel.C(catalogsourcelink.FieldSyncedAt) + " ASC NULLS FIRST"))
		}, ent.Asc(catalogsourcelink.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stale source links: %w", err)
	}
	refs := make([]catalog.Ref, len(rows))
	for i, row := range rows {
		refs[i] = catalog.Ref{Source: row.Source, Entity: catalog.Entity(row.Entity), ExternalID: row.ExternalID}
	}
	return refs, nil
}

func (s *Store) Cursor(ctx context.Context, source string) (string, error) {
	row, err := s.db(ctx).CatalogSyncCursor.Query().Where(catalogsynccursor.Source(source)).Only(ctx)
	if postgres.IsNotFound(err) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load sync cursor: %w", err)
	}
	return row.Cursor, nil
}

func (s *Store) SaveCursor(ctx context.Context, source, cursor string) error {
	err := s.db(ctx).CatalogSyncCursor.Create().
		SetSource(source).
		SetCursor(cursor).
		OnConflict(sql.ConflictColumns(catalogsynccursor.FieldSource)).
		UpdateCursor().
		UpdateUpdated().
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("save sync cursor: %w", err)
	}
	return nil
}

func (s *Store) SyncState(ctx context.Context, source string) (catalog.SyncState, error) {
	row, err := s.db(ctx).CatalogSyncCursor.Query().Where(catalogsynccursor.Source(source)).Only(ctx)
	if postgres.IsNotFound(err) {
		return catalog.SyncState{}, nil
	}
	if err != nil {
		return catalog.SyncState{}, fmt.Errorf("load sync state: %w", err)
	}
	return catalog.SyncState{Cursor: row.Cursor, PulledAt: row.PulledAt, Changes: row.Changes, FailedAt: row.FailedAt, LastError: row.LastError}, nil
}

func (s *Store) RecordPull(ctx context.Context, source string, changes int, at time.Time) error {
	err := s.db(ctx).CatalogSyncCursor.Create().
		SetSource(source).
		SetCursor("").
		SetPulledAt(at).
		SetChanges(changes).
		OnConflict(sql.ConflictColumns(catalogsynccursor.FieldSource)).
		Update(func(row *ent.CatalogSyncCursorUpsert) {
			row.SetPulledAt(at).SetChanges(changes).ClearFailedAt().ClearLastError().SetUpdated(at)
		}).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("record catalog pull: %w", err)
	}
	return nil
}

func (s *Store) RecordPullFailure(ctx context.Context, source, reason string, at time.Time) error {
	if utf8.RuneCountInString(reason) > maxErrorLength {
		reason = string([]rune(reason)[:maxErrorLength])
	}
	err := s.db(ctx).CatalogSyncCursor.Create().
		SetSource(source).
		SetCursor("").
		SetFailedAt(at).
		SetLastError(reason).
		OnConflict(sql.ConflictColumns(catalogsynccursor.FieldSource)).
		Update(func(row *ent.CatalogSyncCursorUpsert) {
			row.SetFailedAt(at).SetLastError(reason).SetUpdated(at)
		}).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("record catalog pull failure: %w", err)
	}
	return nil
}
