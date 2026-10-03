package gamejobs_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
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
	weights := game.HotScoreWeights{Views: 2, Downloads: 3}
	task := gamejobs.HotScoreTask(game.NewHotScoreService(store, weights), slog.New(slog.DiscardHandler))
	if task.Name != "game.refresh_hot_score" || task.Schedule != "0 * * * *" || task.Timeout <= 0 {
		t.Fatalf("task %+v", task)
	}
	if err := task.Run(t.Context()); err != nil {
		t.Fatal(err)
	}
	if len(store.weights) != 1 || store.weights[0] != weights {
		t.Fatalf("refreshed with %+v", store.weights)
	}
}

func TestHotScoreTaskReturnsFailures(t *testing.T) {
	store := &hotScores{err: errors.New("database down")}
	task := gamejobs.HotScoreTask(game.NewHotScoreService(store, game.HotScoreWeights{}), slog.New(slog.DiscardHandler))
	if err := task.Run(t.Context()); !errors.Is(err, store.err) {
		t.Fatalf("failures reach the job runner: %v", err)
	}
}
