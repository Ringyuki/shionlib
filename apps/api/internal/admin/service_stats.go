package admin

import (
	"context"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type StatsDeps struct {
	Store    StatsStore
	Cache    Cache
	Spool    Spool
	Settings setting.Source
	Now      func() time.Time
}

type StatsService struct {
	store    StatsStore
	cache    Cache
	spool    Spool
	settings setting.Source
	now      func() time.Time
}

func NewStatsService(deps StatsDeps) *StatsService {
	return &StatsService{store: deps.Store, cache: deps.Cache, spool: deps.Spool, settings: deps.Settings, now: deps.Now}
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
	counts, err := s.store.Daily(ctx, start, StatsDayOffset)
	if err != nil {
		return nil, err
	}
	points := make([]TrendPoint, days)
	for i := range points {
		date := StatsDay(start.Add(time.Duration(i) * day))
		points[i] = TrendPoint{Date: date, Games: counts.Games[date], Users: counts.Users[date], Downloads: counts.Downloads[date], Views: counts.Views[date]}
	}
	_ = s.cache.Set(ctx, key, points, StatsCacheTTL)
	return points, nil
}

func (s *StatsService) Pending(ctx context.Context) (Pending, error) {
	return s.store.Pending(ctx)
}

func (s *StatsService) Storage(ctx context.Context) (Storage, error) {
	counts, err := s.store.FileCounts(ctx, s.now())
	if err != nil {
		return Storage{}, err
	}
	capacity, err := s.spool.Capacity(ctx)
	if err != nil {
		return Storage{}, err
	}
	available, err := s.spool.Available(ctx)
	if err != nil {
		return Storage{}, err
	}
	return Storage{
		FileCounts:     counts,
		SpoolCapacity:  capacity,
		SpoolAvailable: available,
		SpoolReserve:   upload.SpoolReserve.Read(s.settings),
	}, nil
}

func startOfStatsDay(now time.Time) time.Time {
	shifted := now.UTC().Add(StatsDayOffset)
	midnight := time.Date(shifted.Year(), shifted.Month(), shifted.Day(), 0, 0, 0, 0, time.UTC)
	return midnight.Add(-StatsDayOffset)
}
