package admin

import (
	"context"
	"strconv"
	"time"
)

const (
	StatsCacheTTL    = 5 * time.Minute
	StatsDayOffset   = 8 * time.Hour
	DefaultTrendDays = 30
	MaxTrendDays     = 90
	overviewCacheKey = "admin:stats:overview"
	trendsCacheKey   = "admin:stats:trends:"
	dateLayout       = "2006-01-02"
	day              = 24 * time.Hour
)

type Overview struct {
	TotalGames      int
	TotalUsers      int
	TotalDownloads  int64
	TotalViews      int64
	TotalCharacters int
	TotalDevelopers int
	TotalComments   int
	NewGamesToday   int
	NewUsersToday   int
}

type DailyCounts struct {
	Games map[string]int
	Users map[string]int
}

type TrendPoint struct {
	Date      string
	Games     int
	Users     int
	Downloads int
	Views     int
}

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
