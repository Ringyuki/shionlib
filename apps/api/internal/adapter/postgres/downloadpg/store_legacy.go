package downloadpg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/catalogsourcelink"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresource"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/gamedownloadresourcefile"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
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

func (s *LegacyStore) ListUndescribed(ctx context.Context, afterID, limit int) ([]download.LegacyResource, error) {
	rows, err := s.db(ctx).GameDownloadResource.Query().
		Where(gamedownloadresource.Undescribed(true), gamedownloadresource.IDGT(afterID)).
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
		return nil, fmt.Errorf("list undescribed download resources after %d: %w", afterID, err)
	}
	awaiting, err := s.awaitingCatalog(ctx, rows)
	if err != nil {
		return nil, err
	}
	resources := make([]download.LegacyResource, len(rows))
	for i, row := range rows {
		names := make([]string, len(row.Edges.Files))
		files := make([]download.LegacyFile, len(row.Edges.Files))
		for j, file := range row.Edges.Files {
			names[j] = file.FileName
			files[j] = download.LegacyFile{ID: file.ID, Name: file.FileName, OriginalName: file.OriginalName}
		}
		resources[i] = download.LegacyResource{
			ID:        row.ID,
			GameID:    row.GameID,
			CreatorID: row.CreatorID,
			Languages: nonNilStrings(row.Language),
			Note:      row.Note,
			FileNames: names,
			Files:     files,
			Discs:     len(row.Edges.Inspections) > 0,
			Published: row.PublishedAt != nil && row.Status == download.ResourceActive,
			Canonical: row.CanonicalName,
			Info:      toInfo(row),
			Awaiting:  awaiting[row.GameID],
		}
	}
	return resources, nil
}

func (s *LegacyStore) awaitingCatalog(ctx context.Context, rows []*ent.GameDownloadResource) (map[int]bool, error) {
	gameIDs := make([]int, len(rows))
	for i, row := range rows {
		gameIDs[i] = row.GameID
	}
	links, err := s.db(ctx).CatalogSourceLink.Query().
		Where(
			catalogsourcelink.Entity(string(catalog.EntityGame)),
			catalogsourcelink.LocalIDIn(gameIDs...),
			catalogsourcelink.SyncedAtIsNil(),
			catalogsourcelink.MissingAtIsNil(),
			catalogsourcelink.ExcludedAtIsNil(),
		).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("find games whose catalog entry was not fetched yet: %w", err)
	}
	awaiting := make(map[int]bool, len(links))
	for _, link := range links {
		awaiting[link.LocalID] = true
	}
	return awaiting, nil
}

func (s *LegacyStore) Describe(ctx context.Context, id int, description download.LegacyDescription) error {
	current, err := s.db(ctx).GameDownloadResource.Query().Where(gamedownloadresource.ID(id)).Select(gamedownloadresource.FieldUpdated).Only(ctx)
	if postgres.IsNotFound(err) {
		return download.ErrResourceNotFound
	}
	if err != nil {
		return fmt.Errorf("read download resource %d: %w", id, err)
	}
	update := s.db(ctx).GameDownloadResource.UpdateOneID(id).SetUndescribed(false).SetUpdated(current.Updated)
	if description.Translation != nil {
		update.SetTranslation(string(*description.Translation))
	}
	if description.ReleaseURL != nil {
		update.SetReleaseURL(*description.ReleaseURL)
	}
	if description.Edition != nil {
		update.SetEdition(string(*description.Edition))
	}
	if description.EditionName != nil {
		update.SetEditionName(*description.EditionName)
	}
	if description.Form != nil {
		update.SetForm(string(*description.Form))
	}
	if description.ClearNote {
		update.ClearNote()
	}
	if len(description.Canonical) > 0 {
		update.SetCanonicalName(true)
	}
	if err := update.Exec(ctx); err != nil {
		return fmt.Errorf("describe download resource %d: %w", id, err)
	}
	if err := s.keepNames(ctx, id, description.Canonical); err != nil {
		return err
	}
	return credit(ctx, s.db(ctx), id, description.Translators)
}

func (s *LegacyStore) keepNames(ctx context.Context, resourceID int, fileIDs []int) error {
	if len(fileIDs) == 0 {
		return nil
	}
	files, err := s.db(ctx).GameDownloadResourceFile.Query().
		Where(gamedownloadresourcefile.GameDownloadResourceID(resourceID), gamedownloadresourcefile.IDIn(fileIDs...), gamedownloadresourcefile.OriginalNameIsNil()).
		All(ctx)
	if err != nil {
		return fmt.Errorf("read the files of download resource %d: %w", resourceID, err)
	}
	for _, file := range files {
		if err := s.db(ctx).GameDownloadResourceFile.UpdateOneID(file.ID).SetOriginalName(file.FileName).SetUpdated(file.Updated).Exec(ctx); err != nil {
			return fmt.Errorf("keep the name of download file %d: %w", file.ID, err)
		}
	}
	return nil
}
