package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
)

const (
	countDailyViewSQL = `
INSERT INTO site_daily_stats (day, views) VALUES ($1::date, 1)
ON CONFLICT (day) DO UPDATE SET views = site_daily_stats.views + 1`
	countDailyDownloadSQL = `
INSERT INTO site_daily_stats (day, downloads) VALUES ($1::date, 1)
ON CONFLICT (day) DO UPDATE SET downloads = site_daily_stats.downloads + 1`
)

func CountDailyView(ctx context.Context, db *ent.Client, at time.Time) error {
	if _, err := db.ExecContext(ctx, countDailyViewSQL, admin.StatsDay(at)); err != nil {
		return fmt.Errorf("count a view in its day: %w", err)
	}
	return nil
}

func CountDailyDownload(ctx context.Context, db *ent.Client, at time.Time) error {
	if _, err := db.ExecContext(ctx, countDailyDownloadSQL, admin.StatsDay(at)); err != nil {
		return fmt.Errorf("count a download in its day: %w", err)
	}
	return nil
}
