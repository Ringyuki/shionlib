package translatorpg

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/translatordistinction"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

const entryColumns = `
SELECT t.id, t.name, t.aliases, t.homepage, COALESCE(w.works, 0), COALESCE(a.resources, 0), a.latest
FROM translators t
LEFT JOIN (` + visibleWorks + `) w ON w.translator_id = t.id
LEFT JOIN (
  SELECT c.translator_id, COUNT(*) AS resources, MAX(COALESCE(r.published_at, r.created)) AS latest
  FROM game_download_resource_translators c
  JOIN game_download_resources r ON r.id = c.resource_id
  GROUP BY c.translator_id
) a ON a.translator_id = t.id`

const searchQuery = entryColumns + `
WHERE ` + named + `
ORDER BY
  CASE WHEN $2 = 'works' AND $3 THEN COALESCE(w.works, 0) END DESC,
  CASE WHEN $2 = 'works' AND NOT $3 THEN COALESCE(w.works, 0) END ASC,
  CASE WHEN $2 = 'resources' AND $3 THEN COALESCE(a.resources, 0) END DESC,
  CASE WHEN $2 = 'resources' AND NOT $3 THEN COALESCE(a.resources, 0) END ASC,
  CASE WHEN $2 = 'latest' AND $3 THEN a.latest END DESC NULLS LAST,
  CASE WHEN $2 = 'latest' AND NOT $3 THEN a.latest END ASC NULLS FIRST,
  CASE WHEN $2 = 'name' AND $3 THEN t.name COLLATE "C" END DESC,
  CASE WHEN $2 = 'name' AND NOT $3 THEN t.name COLLATE "C" END ASC,
  t.id
OFFSET $4 LIMIT $5`

const searchCountQuery = `SELECT COUNT(*) FROM translators t WHERE ` + named

const scanQuery = entryColumns + ` ORDER BY t.id LIMIT $1`

type AdminStore struct {
	client *ent.Client
}

func NewAdminStore(client *ent.Client) *AdminStore {
	return &AdminStore{client: client}
}

func (s *AdminStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func sortKey(field translator.SortField) string {
	switch field {
	case translator.SortByResources, translator.SortByLatest, translator.SortByName:
		return string(field)
	default:
		return string(translator.SortByWorks)
	}
}

func (s *AdminStore) Search(ctx context.Context, filter translator.AdminFilter, page translator.Page) ([]translator.AdminEntry, int, error) {
	total, err := s.count(ctx, filter.Search)
	if err != nil {
		return nil, 0, fmt.Errorf("count translators for administration: %w", err)
	}
	rows, err := s.db(ctx).QueryContext(ctx, searchQuery, filter.Search, sortKey(filter.SortBy), filter.Descending, page.Offset(), page.Size)
	if err != nil {
		return nil, 0, fmt.Errorf("search translators: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	entries, err := scanEntries(rows)
	if err != nil {
		return nil, 0, err
	}
	return entries, total, nil
}

func (s *AdminStore) count(ctx context.Context, search string) (int, error) {
	rows, err := s.db(ctx).QueryContext(ctx, searchCountQuery, search)
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = rows.Close()
	}()
	return scanCount(rows)
}

func (s *AdminStore) Scan(ctx context.Context, limit int) ([]translator.AdminEntry, error) {
	rows, err := s.db(ctx).QueryContext(ctx, scanQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("scan translators: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	return scanEntries(rows)
}

func (s *AdminStore) Distinctions(ctx context.Context) ([]translator.Distinction, error) {
	rows, err := s.db(ctx).TranslatorDistinction.Query().
		Order(translatordistinction.ByLowID(), translatordistinction.ByHighID()).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("list translator distinctions: %w", err)
	}
	pairs := make([]translator.Distinction, len(rows))
	for i, row := range rows {
		pairs[i] = translator.Distinction{LowID: row.LowID, HighID: row.HighID}
	}
	return pairs, nil
}

func (s *AdminStore) AddDistinctions(ctx context.Context, pairs []translator.Distinction) error {
	seen := map[translator.Distinction]bool{}
	builders := make([]*ent.TranslatorDistinctionCreate, 0, len(pairs))
	for _, pair := range pairs {
		if seen[pair] {
			continue
		}
		seen[pair] = true
		builders = append(builders, s.db(ctx).TranslatorDistinction.Create().SetLowID(pair.LowID).SetHighID(pair.HighID))
	}
	if len(builders) == 0 {
		return nil
	}
	err := s.db(ctx).TranslatorDistinction.CreateBulk(builders...).
		OnConflictColumns(translatordistinction.FieldLowID, translatordistinction.FieldHighID).
		DoNothing().
		Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("add translator distinctions: %w", err)
	}
	return nil
}
