package game

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

type HotScoreService struct {
	store    HotScoreStore
	settings setting.Source
}

func NewHotScoreService(store HotScoreStore, settings setting.Source) *HotScoreService {
	return &HotScoreService{store: store, settings: settings}
}

func (s *HotScoreService) Refresh(ctx context.Context) (int64, error) {
	return s.store.RefreshHotScore(ctx, HotScoreWeights{
		HalfLifeReleaseDays: HotScoreReleaseHalfLifeDays.Read(s.settings),
		HalfLifeCreatedDays: HotScoreCreatedHalfLifeDays.Read(s.settings),
		Views:               HotScoreViews.Read(s.settings),
		Downloads:           HotScoreDownloads.Read(s.settings),
		Release:             HotScoreRelease.Read(s.settings),
		Created:             HotScoreCreated.Read(s.settings),
		RecentWindowDays:    HotScoreRecentWindowDays.Read(s.settings),
		RecentViews:         HotScoreRecentViews.Read(s.settings),
		RecentDownloads:     HotScoreRecentDownloads.Read(s.settings),
	})
}
