package game_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

type hotScoreStore struct {
	weights game.HotScoreWeights
}

func (s *hotScoreStore) RefreshHotScore(_ context.Context, weights game.HotScoreWeights) (int64, error) {
	s.weights = weights
	return 3, nil
}

func TestHotScoreReadsTheWeightsAtEveryRefresh(t *testing.T) {
	store := &hotScoreStore{}
	settings := settingtest.Source{}
	service := game.NewHotScoreService(store, settings)
	affected, err := service.Refresh(context.Background())
	defaults := game.HotScoreWeights{HalfLifeReleaseDays: 30, HalfLifeCreatedDays: 15, Views: 0.6, Downloads: 1, Release: 0.8, Created: 0.4, RecentWindowDays: 7, RecentViews: 0.6, RecentDownloads: 0.9}
	if err != nil || affected != 3 || store.weights != defaults {
		t.Fatalf("refresh: %d %v %+v", affected, err, store.weights)
	}
	settingtest.Set(settings, game.HotScoreViews, 2)
	settingtest.Set(settings, game.HotScoreReleaseHalfLifeDays, 60)
	if _, err := service.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if store.weights.Views != 2 || store.weights.HalfLifeReleaseDays != 60 || store.weights.Downloads != 1 {
		t.Fatalf("changed weights: %+v", store.weights)
	}
}
