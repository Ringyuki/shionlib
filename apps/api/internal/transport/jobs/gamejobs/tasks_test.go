package gamejobs_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/gamejobs"
)

type hotScores struct {
	weights []game.HotScoreWeights
	err     error
}

func (h *hotScores) RefreshHotScore(_ context.Context, weights game.HotScoreWeights) (int64, error) {
	h.weights = append(h.weights, weights)
	return 3, h.err
}

func TestHotScoreTaskRefreshesWithTheConfiguredWeights(t *testing.T) {
	store := &hotScores{}
	settings := settingtest.Source{}
	settingtest.Set(settings, game.HotScoreViews, 2)
	settingtest.Set(settings, game.HotScoreDownloads, 3)
	task := gamejobs.HotScoreTask(game.NewHotScoreService(store, settings), slog.New(slog.DiscardHandler))
	if task.Name != "game.refresh_hot_score" || task.Schedule != "0 * * * *" || task.Timeout <= 0 {
		t.Fatalf("task %+v", task)
	}
	if err := task.Run(t.Context()); err != nil {
		t.Fatal(err)
	}
	want := game.HotScoreWeights{HalfLifeReleaseDays: 30, HalfLifeCreatedDays: 15, Views: 2, Downloads: 3, Release: 0.8, Created: 0.4, RecentWindowDays: 7, RecentViews: 0.6, RecentDownloads: 0.9}
	if len(store.weights) != 1 || store.weights[0] != want {
		t.Fatalf("refreshed with %+v", store.weights)
	}
}

func TestHotScoreTaskReturnsFailures(t *testing.T) {
	store := &hotScores{err: errors.New("database down")}
	task := gamejobs.HotScoreTask(game.NewHotScoreService(store, settingtest.Source{}), slog.New(slog.DiscardHandler))
	if err := task.Run(t.Context()); !errors.Is(err, store.err) {
		t.Fatalf("failures reach the job runner: %v", err)
	}
}
