package catalogpg

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsynccursor"
	entgame "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
)

const (
	gameStatusHidden = 2
	maxErrorLength   = 500
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

func (s *Store) claimLink(ctx context.Context, ref catalog.Ref, localID int) (int, error) {
	err := s.db(ctx).CatalogSourceLink.Create().
		SetSource(ref.Source).
		SetEntity(string(ref.Entity)).
		SetExternalID(ref.ExternalID).
		SetLocalID(localID).
		OnConflict(sql.ConflictColumns(catalogsourcelink.FieldSource, catalogsourcelink.FieldEntity, catalogsourcelink.FieldExternalID)).
		DoNothing().
		Exec(ctx)
	if err != nil && !postgres.IsNotFound(err) {
		return 0, fmt.Errorf("claim source link: %w", err)
	}
	row, err := s.link(ctx, ref)
	if err != nil {
		return 0, err
	}
	if row == nil {
		return 0, fmt.Errorf("claim source link %s/%s/%s: link vanished", ref.Source, ref.Entity, ref.ExternalID)
	}
	return row.LocalID, nil
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

func (s *Store) Exclude(ctx context.Context, entity catalog.Entity, localID int, at time.Time) error {
	err := s.db(ctx).CatalogSourceLink.Update().
		Where(catalogsourcelink.Entity(string(entity)), catalogsourcelink.LocalID(localID)).
		SetExcludedAt(at).
		SetUpdated(at).
		Exec(ctx)
	if err != nil {
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
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("include source link: %w", err)
	}
	return nil
}

func (s *Store) Excluded(ctx context.Context, ref catalog.Ref) (bool, error) {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return false, err
	}
	return row.ExcludedAt != nil, nil
}

func (s *Store) RecordFailure(ctx context.Context, ref catalog.Ref, reason string, at time.Time) error {
	row, err := s.link(ctx, ref)
	if err != nil || row == nil {
		return err
	}
	if len(reason) > maxErrorLength {
		reason = reason[:maxErrorLength]
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
