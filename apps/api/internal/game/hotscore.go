package game

import "context"

type HotScoreWeights struct {
	HalfLifeReleaseDays float64
	HalfLifeCreatedDays float64
	Views               float64
	Downloads           float64
	Release             float64
	Created             float64
	RecentWindowDays    float64
	RecentViews         float64
	RecentDownloads     float64
}

type HotScoreService struct {
	store   HotScoreStore
	weights HotScoreWeights
}

func NewHotScoreService(store HotScoreStore, weights HotScoreWeights) *HotScoreService {
	return &HotScoreService{store: store, weights: weights}
}

func (s *HotScoreService) Refresh(ctx context.Context) (int64, error) {
	return s.store.RefreshHotScore(ctx, s.weights)
}
