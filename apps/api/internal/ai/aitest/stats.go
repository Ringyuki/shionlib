package aitest

import (
	"context"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type Stats struct {
	mu            sync.Mutex
	GroupedStats  map[ai.Dimension]map[string]ai.Stats
	Latest        map[int]ai.LastAttempt
	Used          map[int]time.Time
	Totals        ai.Stats
	SeriesBuckets []ai.SeriesBucket
	Costs         []ai.CostBucket
	Rows          []ai.BreakdownRow
	Filters       []ai.RequestFilter
}

func NewStats() *Stats {
	return &Stats{GroupedStats: map[ai.Dimension]map[string]ai.Stats{}, Latest: map[int]ai.LastAttempt{}, Used: map[int]time.Time{}}
}

func (s *Stats) Grouped(_ context.Context, dimension ai.Dimension, _ time.Time) (map[string]ai.Stats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	grouped := map[string]ai.Stats{}
	for key, stats := range s.GroupedStats[dimension] {
		grouped[key] = stats
	}
	return grouped, nil
}

func (s *Stats) LatestAttempts(_ context.Context, routeIDs []int) (map[int]ai.LastAttempt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	latest := map[int]ai.LastAttempt{}
	for _, id := range routeIDs {
		if attempt, ok := s.Latest[id]; ok {
			latest[id] = attempt
		}
	}
	return latest, nil
}

func (s *Stats) LastUsed(context.Context) (map[int]time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	used := map[int]time.Time{}
	for id, at := range s.Used {
		used[id] = at
	}
	return used, nil
}

func (s *Stats) Metrics(_ context.Context, filter ai.RequestFilter, _ time.Time) (ai.Stats, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Filters = append(s.Filters, filter)
	return s.Totals, nil
}

func (s *Stats) Buckets(_ context.Context, filter ai.RequestFilter, _ time.Duration) ([]ai.SeriesBucket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Filters = append(s.Filters, filter)
	return append([]ai.SeriesBucket{}, s.SeriesBuckets...), nil
}

func (s *Stats) CostBuckets(_ context.Context, filter ai.RequestFilter, _ time.Duration) ([]ai.CostBucket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Filters = append(s.Filters, filter)
	return append([]ai.CostBucket{}, s.Costs...), nil
}

func (s *Stats) Breakdown(_ context.Context, _ ai.Dimension, _ time.Time, limit int) ([]ai.BreakdownRow, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := append([]ai.BreakdownRow{}, s.Rows...)
	if len(rows) > limit {
		rows = rows[:limit]
	}
	return rows, nil
}
