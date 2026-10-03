package game

import (
	"context"
)

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
