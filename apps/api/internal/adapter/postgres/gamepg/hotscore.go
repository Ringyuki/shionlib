package gamepg

import (
	"context"
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

const refreshHotScoreSQL = `
WITH base AS (
  SELECT
    g.id,
    GREATEST(1.0, EXTRACT(EPOCH FROM (NOW() - g.created)) / 86400.0) AS age_days,
    GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - COALESCE(g.release_date, g.created))) / 86400.0) AS release_age_days,
    g.views,
    g.downloads
  FROM "games" g
  WHERE g.status = 1
    AND COALESCE(g.release_date, g.created) <= NOW()
),
scores AS (
  SELECT
    b.id,
    (
      $1::float8 * LN(b.views + 1) +
      $2::float8 * LN(b.downloads + 1) +
      $3::float8 * LN(($4::float8 * b.views) / b.age_days + 1) +
      $5::float8 * LN(($4::float8 * b.downloads) / b.age_days + 1) +
      $6::float8 * EXP(- b.release_age_days / $7::float8) +
      $8::float8 * EXP(- b.age_days / $9::float8)
    ) AS new_score
  FROM base b
)
UPDATE "games" AS g
SET "hot_score" = s.new_score
FROM scores s
WHERE g.id = s.id
  AND g."hot_score" IS DISTINCT FROM s.new_score`

func (r *Repository) RefreshHotScore(ctx context.Context, w game.HotScoreWeights) (int64, error) {
	result, err := r.db(ctx).ExecContext(ctx, refreshHotScoreSQL,
		w.Views, w.Downloads, w.RecentViews, w.RecentWindowDays, w.RecentDownloads,
		w.Release, w.HalfLifeReleaseDays, w.Created, w.HalfLifeCreatedDays,
	)
	if err != nil {
		return 0, fmt.Errorf("refresh hot scores: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("count refreshed hot scores: %w", err)
	}
	return affected, nil
}

type Preferences struct {
	client *ent.Client
}

func NewPreferences(client *ent.Client) *Preferences {
	return &Preferences{client: client}
}

func (p *Preferences) OnlyGamesWithResources(ctx context.Context, userID int) (bool, error) {
	row, err := postgres.Client(ctx, p.client).User.Query().
		Where(user.ID(userID)).
		Select(user.FieldOnlyGamesWithResources).
		Only(ctx)
	if postgres.IsNotFound(err) {
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("read resource preference of user %d: %w", userID, err)
	}
	return row.OnlyGamesWithResources, nil
}
