package indexingpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const changesQuery = `
SELECT kind, id, game_id, at FROM (
  SELECT 'resource' AS kind, r.id, r.game_id, r.published_at AS at
  FROM game_download_resources r WHERE r.published_at > $1
  UNION ALL
  SELECT 'resource', r.id, r.game_id, e.created
  FROM game_download_resource_events e JOIN game_download_resources r ON r.id = e.resource_id
  WHERE e.created > $1 AND r.published_at IS NOT NULL
  UNION ALL
  SELECT 'walkthrough', w.id, w.game_id, w.updated
  FROM walkthroughs w WHERE w.updated > $1 AND w.status <> $2
) changes ORDER BY at, kind, id LIMIT $3`

type ChangeStore struct {
	client *ent.Client
}

func NewChangeStore(client *ent.Client) *ChangeStore {
	return &ChangeStore{client: client}
}

func (f *ChangeStore) Changes(ctx context.Context, since time.Time, limit int) ([]indexing.Change, error) {
	rows, err := postgres.Client(ctx, f.client).QueryContext(ctx, changesQuery, since.UTC(), string(walkthrough.StatusDraft), limit)
	if err != nil {
		return nil, fmt.Errorf("list changes since %s: %w", since, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	changes := []indexing.Change{}
	for rows.Next() {
		var (
			change indexing.Change
			kind   string
		)
		if err := rows.Scan(&kind, &change.ID, &change.GameID, &change.At); err != nil {
			return nil, fmt.Errorf("scan change: %w", err)
		}
		change.Kind = indexing.ChangeKind(kind)
		change.At = change.At.UTC()
		changes = append(changes, change)
	}
	return changes, rows.Err()
}
