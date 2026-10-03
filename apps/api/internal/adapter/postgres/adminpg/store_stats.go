package adminpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
)

const (
	activeStatus  = 1
	overviewQuery = `
SELECT
  (SELECT COUNT(*) FROM games WHERE status = $1),
  (SELECT COUNT(*) FROM users WHERE status = $1),
  (SELECT COALESCE(SUM(downloads), 0)::bigint FROM games WHERE status = $1),
  (SELECT COALESCE(SUM(views), 0)::bigint FROM games WHERE status = $1),
  (SELECT COUNT(*) FROM game_characters),
  (SELECT COUNT(*) FROM game_developers),
  (SELECT COUNT(*) FROM comments),
  (SELECT COUNT(*) FROM games WHERE status = $1 AND created >= $2),
  (SELECT COUNT(*) FROM users WHERE status = $1 AND created >= $2)`
	dailyQuery = `
SELECT 'games', to_char(created + make_interval(secs => $3), 'YYYY-MM-DD') AS day, COUNT(*) FROM games WHERE created >= $1 AND status = $2 GROUP BY day
UNION ALL
SELECT 'users', to_char(created + make_interval(secs => $3), 'YYYY-MM-DD') AS day, COUNT(*) FROM users WHERE created >= $1 AND status = $2 GROUP BY day`
)

type StatsStore struct {
	client *ent.Client
}

func NewStatsStore(client *ent.Client) *StatsStore {
	return &StatsStore{client: client}
}

func (s *StatsStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func (s *StatsStore) Overview(ctx context.Context, since time.Time) (admin.Overview, error) {
	rows, err := s.db(ctx).QueryContext(ctx, overviewQuery, activeStatus, since.UTC())
	if err != nil {
		return admin.Overview{}, fmt.Errorf("aggregate admin overview: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var o admin.Overview
	if rows.Next() {
		if err := rows.Scan(&o.TotalGames, &o.TotalUsers, &o.TotalDownloads, &o.TotalViews, &o.TotalCharacters, &o.TotalDevelopers, &o.TotalComments, &o.NewGamesToday, &o.NewUsersToday); err != nil {
			return admin.Overview{}, fmt.Errorf("scan admin overview: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return admin.Overview{}, fmt.Errorf("read admin overview: %w", err)
	}
	return o, nil
}

func (s *StatsStore) DailyCreations(ctx context.Context, since time.Time, offset time.Duration) (admin.DailyCounts, error) {
	rows, err := s.db(ctx).QueryContext(ctx, dailyQuery, since.UTC(), activeStatus, offset.Seconds())
	if err != nil {
		return admin.DailyCounts{}, fmt.Errorf("count daily creations: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	counts := admin.DailyCounts{Games: map[string]int{}, Users: map[string]int{}}
	for rows.Next() {
		var (
			kind string
			date string
			n    int
		)
		if err := rows.Scan(&kind, &date, &n); err != nil {
			return admin.DailyCounts{}, fmt.Errorf("scan daily creations: %w", err)
		}
		if kind == "games" {
			counts.Games[date] = n
		} else {
			counts.Users[date] = n
		}
	}
	if err := rows.Err(); err != nil {
		return admin.DailyCounts{}, fmt.Errorf("read daily creations: %w", err)
	}
	return counts, nil
}
