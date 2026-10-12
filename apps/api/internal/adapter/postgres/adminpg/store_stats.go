package adminpg

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
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
  (SELECT COUNT(*) FROM game_download_resources WHERE status = $1 AND published_at IS NOT NULL),
  (SELECT COUNT(*) FROM games WHERE status = $1 AND created >= $2),
  (SELECT COUNT(*) FROM users WHERE status = $1 AND created >= $2),
  (SELECT COUNT(*) FROM game_download_resources WHERE status = $1 AND published_at >= $2),
  (SELECT COUNT(*) FROM comments WHERE created >= $2),
  COALESCE((SELECT downloads FROM site_daily_stats WHERE day = $3::date), 0),
  COALESCE((SELECT views FROM site_daily_stats WHERE day = $3::date), 0)`
	dailyQuery = `
SELECT 'games', to_char(created + make_interval(secs => $3), 'YYYY-MM-DD') AS day, COUNT(*) FROM games WHERE created >= $1 AND status = $2 GROUP BY day
UNION ALL
SELECT 'users', to_char(created + make_interval(secs => $3), 'YYYY-MM-DD') AS day, COUNT(*) FROM users WHERE created >= $1 AND status = $2 GROUP BY day
UNION ALL
SELECT 'downloads', to_char(day, 'YYYY-MM-DD'), downloads FROM site_daily_stats WHERE day >= $4::date
UNION ALL
SELECT 'views', to_char(day, 'YYYY-MM-DD'), views FROM site_daily_stats WHERE day >= $4::date`
	pendingQuery = `
SELECT
  (SELECT COUNT(*) FROM game_download_resource_reports WHERE status = 'PENDING'),
  (SELECT COUNT(*) FROM malware_scan_cases WHERE status = 'PENDING'),
  (SELECT COUNT(*) FROM game_download_resource_files WHERE type = $1 AND file_status = $2 AND file_check_status = $3),
  (SELECT COUNT(*) FROM comments WHERE status = $4),
  (SELECT COUNT(*) FROM walkthroughs WHERE review_pending AND status <> 'DELETED')`
	fileCountsQuery = `
SELECT
  (SELECT COUNT(*) FROM game_upload_sessions WHERE status = 'UPLOADING' AND expires_at >= $1),
  (SELECT COALESCE(SUM(total_size), 0)::bigint FROM game_upload_sessions WHERE status = 'UPLOADING' AND expires_at >= $1),
  (SELECT COUNT(*) FROM game_download_resource_files f JOIN game_download_resources r ON r.id = f.game_download_resource_id
    WHERE f.type = $2 AND f.file_status = $3 AND f.file_check_status = $5 AND r.status = $7),
  (SELECT COUNT(*) FROM game_download_resource_files f JOIN game_download_resources r ON r.id = f.game_download_resource_id
    WHERE f.type = $2 AND f.file_status = $3 AND f.file_check_status = $6 AND r.status = $7),
  (SELECT COUNT(*) FROM game_download_resource_files f JOIN game_download_resources r ON r.id = f.game_download_resource_id
    WHERE f.type = $2 AND f.file_status = $4 AND r.status = $7),
  (SELECT COALESCE(SUM(f.file_size), 0)::bigint FROM game_download_resource_files f JOIN game_download_resources r ON r.id = f.game_download_resource_id
    WHERE f.type = $2 AND f.file_status = $4 AND r.status = $7)`
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
	var o admin.Overview
	err := s.row(ctx, overviewQuery, []any{activeStatus, since.UTC(), admin.StatsDay(since)},
		&o.TotalGames, &o.TotalUsers, &o.TotalDownloads, &o.TotalViews, &o.TotalCharacters, &o.TotalDevelopers, &o.TotalComments, &o.TotalResources,
		&o.NewGamesToday, &o.NewUsersToday, &o.NewResourcesToday, &o.NewCommentsToday, &o.DownloadsToday, &o.ViewsToday)
	if err != nil {
		return admin.Overview{}, fmt.Errorf("aggregate admin overview: %w", err)
	}
	return o, nil
}

func (s *StatsStore) Daily(ctx context.Context, since time.Time, offset time.Duration) (admin.DailyCounts, error) {
	rows, err := s.db(ctx).QueryContext(ctx, dailyQuery, since.UTC(), activeStatus, offset.Seconds(), admin.StatsDay(since))
	if err != nil {
		return admin.DailyCounts{}, fmt.Errorf("count daily activity: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	counts := admin.DailyCounts{Games: map[string]int{}, Users: map[string]int{}, Downloads: map[string]int{}, Views: map[string]int{}}
	series := map[string]map[string]int{"games": counts.Games, "users": counts.Users, "downloads": counts.Downloads, "views": counts.Views}
	for rows.Next() {
		var (
			kind string
			date string
			n    int
		)
		if err := rows.Scan(&kind, &date, &n); err != nil {
			return admin.DailyCounts{}, fmt.Errorf("scan daily activity: %w", err)
		}
		series[kind][date] = n
	}
	if err := rows.Err(); err != nil {
		return admin.DailyCounts{}, fmt.Errorf("read daily activity: %w", err)
	}
	return counts, nil
}

func (s *StatsStore) Pending(ctx context.Context) (admin.Pending, error) {
	var p admin.Pending
	err := s.row(ctx, pendingQuery, []any{download.FileTypeObjectStore, download.FileOnServer, int(download.CheckStalled), int(comment.StatusPending)},
		&p.Reports, &p.MalwareCases, &p.StalledFiles, &p.Comments, &p.Walkthroughs)
	if err != nil {
		return admin.Pending{}, fmt.Errorf("count what waits for an admin: %w", err)
	}
	return p, nil
}

func (s *StatsStore) FileCounts(ctx context.Context, now time.Time) (admin.FileCounts, error) {
	var c admin.FileCounts
	args := []any{now.UTC(), download.FileTypeObjectStore, download.FileOnServer, download.FileInObjectStore, int(download.CheckPending), int(download.CheckOK), download.ResourceActive}
	err := s.row(ctx, fileCountsQuery, args, &c.Uploading.Files, &c.Uploading.Bytes, &c.AwaitingCheck, &c.AwaitingStore, &c.Stored.Files, &c.Stored.Bytes)
	if err != nil {
		return admin.FileCounts{}, fmt.Errorf("count files by stage: %w", err)
	}
	return c, nil
}

func (s *StatsStore) row(ctx context.Context, query string, args []any, dest ...any) error {
	rows, err := s.db(ctx).QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer func() {
		_ = rows.Close()
	}()
	if rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return err
		}
	}
	return rows.Err()
}
