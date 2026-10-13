package analysis_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis/analysistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var (
	now        = time.Date(2026, 10, 3, 12, 34, 56, 0, time.UTC)
	strict     = actor.Guest()
	permissive = actor.Actor{UserID: 1, ContentLimit: actor.ContentLimitJustShow}
	quiet      = slog.New(slog.NewTextHandler(io.Discard, nil))
)

func TestOverviewIsCachedAndDegradesTraffic(t *testing.T) {
	ctx := context.Background()
	stats := &analysistest.Stats{Total: analysis.Totals{Games: 3, Files: 4, Resources: 5, StorageBytes: 6}}
	service := analysis.NewService(stats, analysistest.Served{Bytes: 99}, &analysistest.Traffic{}, analysistest.NewCache(), quiet, func() time.Time { return now })
	overview, err := service.Overview(ctx)
	if err != nil || overview.Games != 3 || overview.BytesServed != 99 {
		t.Fatalf("overview: %+v %v", overview, err)
	}
	if _, err := service.Overview(ctx); err != nil || stats.Calls != 1 {
		t.Fatalf("second read comes from the cache: calls=%d %v", stats.Calls, err)
	}
	degraded := analysis.NewService(stats, analysistest.Served{Fail: errors.New("graphql error")}, &analysistest.Traffic{}, analysistest.NewCache(), quiet, func() time.Time { return now })
	overview, err = degraded.Overview(ctx)
	if err != nil || overview.BytesServed != 0 || overview.Games != 3 {
		t.Fatalf("traffic failures report zero bytes: %+v %v", overview, err)
	}
}

func TestTrafficDetail(t *testing.T) {
	ctx := context.Background()
	currentHour := now.Truncate(time.Hour)
	traffic := &analysistest.Traffic{Raw: analysis.RawTraffic{
		Current:  analysis.Counter{DownloadCount: 3, TotalBytes: 10},
		Previous: analysis.Counter{},
		Hourly: []analysis.HourPoint{
			{Hour: currentHour.Add(-23 * time.Hour), Counter: analysis.Counter{DownloadCount: 1, TotalBytes: 4}},
			{Hour: currentHour, Counter: analysis.Counter{DownloadCount: 2, TotalBytes: 6}},
		},
		TopFiles: []analysis.FileTraffic{{FileID: "7", FileName: "safe.zip"}, {FileID: "8", FileName: "rated.zip"}},
		TopGames: []analysis.RawGameTraffic{{GameID: 1}, {GameID: 2}, {GameID: 404}},
	}}
	stats := &analysistest.Stats{
		Refs:  map[int]analysis.GameRef{1: {Titles: analysis.GameTitles{JP: "safe"}}, 2: {Titles: analysis.GameTitles{JP: "rated"}, Rated: true}},
		Rated: map[int]bool{8: true},
	}
	service := analysis.NewService(stats, analysistest.Served{}, traffic, analysistest.NewCache(), quiet, func() time.Time { return now })

	full, err := service.TrafficDetail(ctx, permissive)
	if err != nil {
		t.Fatal(err)
	}
	if !traffic.Window.HourlySince.Equal(currentHour.Add(-23*time.Hour)) || !traffic.Window.Since48h.Equal(now.Add(-48*time.Hour)) {
		t.Fatalf("unexpected window %+v", traffic.Window)
	}
	if len(full.Hourly) != 24 || !full.Hourly[0].Hour.Equal(currentHour.Add(-23*time.Hour)) || full.Hourly[0].TotalBytes != 4 || full.Hourly[1].TotalBytes != 0 || full.Hourly[23].DownloadCount != 2 {
		t.Fatalf("hours are zero-filled: %+v", full.Hourly)
	}
	if full.Current.AverageSize() != 3 || full.Previous.AverageSize() != 0 {
		t.Fatalf("average size: %d %d", full.Current.AverageSize(), full.Previous.AverageSize())
	}
	if len(full.TopGames) != 3 || full.TopGames[2].Titles != nil || full.TopGames[0].Titles.JP != "safe" || len(full.TopFiles) != 2 {
		t.Fatalf("permissive viewers see everything: %+v", full)
	}
	filtered, err := service.TrafficDetail(ctx, strict)
	if err != nil || traffic.Calls != 1 {
		t.Fatalf("second read comes from the cache: %v calls=%d", err, traffic.Calls)
	}
	if len(filtered.TopGames) != 2 || filtered.TopGames[0].GameID != 1 || filtered.TopGames[1].GameID != 404 || len(filtered.TopFiles) != 1 || filtered.TopFiles[0].FileID != "7" {
		t.Fatalf("strict viewers do not see rated games or their files: %+v", filtered)
	}
}

func TestTrafficDetailFailures(t *testing.T) {
	ctx := context.Background()
	for name, tc := range map[string]struct {
		fail    error
		message string
	}{
		"missing config": {analysis.ErrNotConfigured, analysis.MissingConfigMessage},
		"upstream":       {errors.New("dial tcp: connection refused"), analysis.UpstreamFailedMessage},
	} {
		t.Run(name, func(t *testing.T) {
			service := analysis.NewService(&analysistest.Stats{}, analysistest.Served{}, &analysistest.Traffic{Fail: tc.fail}, analysistest.NewCache(), quiet, func() time.Time { return now })
			_, err := service.TrafficDetail(ctx, strict)
			if !errors.Is(err, analysis.ErrTrafficDetailUnavailable) {
				t.Fatalf("expected 590101, got %v", err)
			}
			appErr, _ := apperror.From(err)
			if appErr.Args()["message"] != tc.message {
				t.Fatalf("internal details must not leak: %v", appErr.Args())
			}
		})
	}
}
