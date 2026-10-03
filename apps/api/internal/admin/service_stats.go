package admin

import (
	"context"
	"strconv"
	"time"
)

type StatsService struct {
	store StatsStore
	cache Cache
	now   func() time.Time
}

func NewStatsService(store StatsStore, cache Cache, now func() time.Time) *StatsService {
	return &StatsService{store: store, cache: cache, now: now}
}

func (s *StatsService) Overview(ctx context.Context) (Overview, error) {
	var cached Overview
	if found, err := s.cache.Get(ctx, overviewCacheKey, &cached); err == nil && found {
		return cached, nil
	}
	overview, err := s.store.Overview(ctx, startOfStatsDay(s.now()))
	if err != nil {
		return Overview{}, err
	}
	_ = s.cache.Set(ctx, overviewCacheKey, overview, StatsCacheTTL)
	return overview, nil
}

func (s *StatsService) Trends(ctx context.Context, days int) ([]TrendPoint, error) {
	if days <= 0 {
		days = DefaultTrendDays
	}
	days = min(days, MaxTrendDays)
	key := trendsCacheKey + strconv.Itoa(days)
	var cached []TrendPoint
	if found, err := s.cache.Get(ctx, key, &cached); err == nil && found {
		return cached, nil
	}
	start := startOfStatsDay(s.now()).Add(-time.Duration(days-1) * day)
	counts, err := s.store.DailyCreations(ctx, start, StatsDayOffset)
	if err != nil {
		return nil, err
	}
	points := make([]TrendPoint, days)
	for i := range points {
		date := start.Add(time.Duration(i) * day).Add(StatsDayOffset).Format(dateLayout)
		points[i] = TrendPoint{Date: date, Games: counts.Games[date], Users: counts.Users[date]}
	}
	_ = s.cache.Set(ctx, key, points, StatsCacheTTL)
	return points, nil
}

func startOfStatsDay(now time.Time) time.Time {
	shifted := now.UTC().Add(StatsDayOffset)
	midnight := time.Date(shifted.Year(), shifted.Month(), shifted.Day(), 0, 0, 0, 0, time.UTC)
	return midnight.Add(-StatsDayOffset)
}
