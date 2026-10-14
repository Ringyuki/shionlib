package sitemappg

import (
	"context"
	"database/sql"
	"fmt"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const visibleGame = `g.status = 1`

const publicResource = `r.status = 1 AND r.published_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM game_download_resource_files f WHERE f.game_download_resource_id = r.id AND f.file_check_status = $1)`

const resourceModified = `GREATEST(r.published_at, (SELECT MAX(e.created) FROM game_download_resource_events e WHERE e.resource_id = r.id))`

const translatorWorks = `EXISTS (
  SELECT 1 FROM game_download_resource_translators c
  JOIN game_download_resources r ON r.id = c.resource_id AND r.status = 1 AND r.published_at IS NOT NULL
  JOIN games g ON g.id = r.game_id AND ` + visibleGame + `
  WHERE c.translator_id = t.id)`

type sectionQuery struct {
	count     string
	countArgs []any
	entries   string
	entryArgs []any
}

var underReview = int(download.CheckHarmfulPendingReview)

var queries = map[sitemap.Section]sectionQuery{
	sitemap.SectionGame: {
		count: `SELECT COUNT(*) FROM games g WHERE ` + visibleGame,
		entries: `SELECT g.id, 0, MAX(` + resourceModified + `)
  FROM games g LEFT JOIN game_download_resources r ON r.game_id = g.id AND ` + publicResource + `
  WHERE ` + visibleGame + ` GROUP BY g.id ORDER BY g.id OFFSET $2 LIMIT $3`,
		entryArgs: []any{underReview},
	},
	sitemap.SectionResource: {
		count: `SELECT COUNT(*) FROM game_download_resources r JOIN games g ON g.id = r.game_id AND ` + visibleGame + ` WHERE ` + publicResource,
		entries: `SELECT r.id, r.game_id, ` + resourceModified + `
  FROM game_download_resources r JOIN games g ON g.id = r.game_id AND ` + visibleGame + `
  WHERE ` + publicResource + ` ORDER BY r.id OFFSET $2 LIMIT $3`,
		countArgs: []any{underReview},
		entryArgs: []any{underReview},
	},
	sitemap.SectionWalkthrough: {
		count: `SELECT COUNT(*) FROM walkthroughs w JOIN games g ON g.id = w.game_id AND ` + visibleGame + ` WHERE w.status = $1`,
		entries: `SELECT w.id, w.game_id, w.updated
  FROM walkthroughs w JOIN games g ON g.id = w.game_id AND ` + visibleGame + `
  WHERE w.status = $1 ORDER BY w.id OFFSET $2 LIMIT $3`,
		countArgs: []any{string(walkthrough.StatusPublished)},
		entryArgs: []any{string(walkthrough.StatusPublished)},
	},
	sitemap.SectionDeveloper: {
		count:   `SELECT COUNT(*) FROM game_developers`,
		entries: `SELECT id, 0, NULL::timestamp FROM game_developers ORDER BY id OFFSET $1 LIMIT $2`,
	},
	sitemap.SectionCharacter: {
		count:   `SELECT COUNT(*) FROM game_characters`,
		entries: `SELECT id, 0, NULL::timestamp FROM game_characters ORDER BY id OFFSET $1 LIMIT $2`,
	},
	sitemap.SectionTranslator: {
		count:   `SELECT COUNT(*) FROM translators t WHERE ` + translatorWorks,
		entries: `SELECT t.id, 0, NULL::timestamp FROM translators t WHERE ` + translatorWorks + ` ORDER BY t.id OFFSET $1 LIMIT $2`,
	},
}

type Store struct {
	client *ent.Client
}

func NewStore(client *ent.Client) *Store {
	return &Store{client: client}
}

func (s *Store) Count(ctx context.Context, section sitemap.Section) (int, error) {
	query, ok := queries[section]
	if !ok {
		return 0, nil
	}
	rows, err := postgres.Client(ctx, s.client).QueryContext(ctx, query.count, query.countArgs...)
	if err != nil {
		return 0, fmt.Errorf("count sitemap %s entries: %w", section, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var count int
	for rows.Next() {
		if err := rows.Scan(&count); err != nil {
			return 0, fmt.Errorf("scan sitemap %s count: %w", section, err)
		}
	}
	return count, rows.Err()
}

func (s *Store) Entries(ctx context.Context, section sitemap.Section, offset, limit int) ([]sitemap.Entry, error) {
	entries := []sitemap.Entry{}
	query, ok := queries[section]
	if !ok {
		return entries, nil
	}
	rows, err := postgres.Client(ctx, s.client).QueryContext(ctx, query.entries, append(slices.Clone(query.entryArgs), offset, limit)...)
	if err != nil {
		return nil, fmt.Errorf("list sitemap %s entries: %w", section, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var (
			entry    sitemap.Entry
			modified sql.NullTime
		)
		if err := rows.Scan(&entry.ID, &entry.GameID, &modified); err != nil {
			return nil, fmt.Errorf("scan sitemap %s entry: %w", section, err)
		}
		if modified.Valid {
			at := modified.Time.UTC().Truncate(time.Second)
			entry.Modified = &at
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}
