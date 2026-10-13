package downloadpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

type LegacyStore struct {
	client *ent.Client
}

func NewLegacyStore(client *ent.Client) *LegacyStore {
	return &LegacyStore{client: client}
}

func (s *LegacyStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *LegacyStore) ListLegacy(ctx context.Context, afterID, limit int) ([]download.LegacyResource, error) {
	rows, err := s.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.IDGT(afterID)).
		Order(ent.Asc(gamedownloadresource.FieldID)).
		Limit(limit).
		WithFiles(func(q *ent.GameDownloadResourceFileQuery) {
			q.Order(ent.Asc(gamedownloadresourcefile.FieldID))
		}).
		WithInspections(func(q *ent.InspectionQuery) {
			q.Where(inspection.DiscCountGT(0))
		}).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list download resources after %d: %w", afterID, err)
	}
	resources := make([]download.LegacyResource, len(rows))
	for i, row := range rows {
		names := make([]string, len(row.Edges.Files))
		for j, file := range row.Edges.Files {
			names[j] = file.FileName
		}
		resources[i] = download.LegacyResource{
			ID:        row.ID,
			CreatorID: row.CreatorID,
			Languages: nonNilStrings(row.Language),
			Note:      row.Note,
			FileNames: names,
			Discs:     len(row.Edges.Inspections) > 0,
			Info:      toInfo(row),
		}
	}
	return resources, nil
}

func (s *LegacyStore) Describe(ctx context.Context, id int, description download.LegacyDescription) error {
	current, err := s.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).Select(gamedownloadresource.FieldUpdated).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("read download resource %d: %w", id, err)
	}
	update := s.db(ctx).GameDownloadResource.UpdateOneID(id).SetUpdated(current.Updated)
	if description.Translation != nil {
		update.SetTranslation(string(*description.Translation))
	}
	if description.ReleaseURL != nil {
		update.SetReleaseURL(*description.ReleaseURL)
	}
	if description.Edition != nil {
		update.SetEdition(string(*description.Edition))
	}
	if description.Form != nil {
		update.SetForm(string(*description.Form))
	}
	if description.ClearNote {
		update.ClearNote()
	}
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("describe download resource %d: %w", id, err)
	}
	return credit(ctx, s.db(ctx), id, description.Translators)
}
