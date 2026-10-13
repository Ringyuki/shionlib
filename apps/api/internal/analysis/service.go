package analysis

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

type Service struct {
	stats   Stats
	served  BytesServed
	traffic DownloadTraffic
	cache   Cache
	logger  *slog.Logger
	now     func() time.Time
}

func NewService(stats Stats, served BytesServed, traffic DownloadTraffic, cache Cache, logger *slog.Logger, now func() time.Time) *Service {
	return &Service{stats: stats, served: served, traffic: traffic, cache: cache, logger: logger, now: now}
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	var cached Overview
	if found, err := s.cache.Get(ctx, OverviewCacheKey, &cached); err == nil && found {
		return cached, nil
	}
	totals, err := s.stats.Totals(ctx)
	if err != nil {
		return Overview{}, err
	}
	overview := Overview{Totals: totals, BytesServed: s.bytesServed(ctx)}
	_ = s.cache.Set(ctx, OverviewCacheKey, overview, OverviewCacheTTL)
	return overview, nil
}

func (s *Service) bytesServed(ctx context.Context) int64 {
	now := s.now().UTC()
	bytes, err := s.served.BytesServed(ctx, now.Add(-24*time.Hour), now)
	if err != nil {
		s.logger.WarnContext(ctx, "download traffic unavailable; reporting zero bytes", slog.Any("error", err))
		return 0
	}
	return bytes
}

func (s *Service) TrafficDetail(ctx context.Context, viewer actor.Actor) (TrafficDetail, error) {
	var cached TrafficDetail
	if found, err := s.cache.Get(ctx, TrafficCacheKey, &cached); err == nil && found {
		return cached.VisibleTo(viewer), nil
	}
	detail, err := s.buildTraffic(ctx)
	if errors.Is(err, ErrNotConfigured) {
		return TrafficDetail{}, ErrTrafficDetailUnavailable.Wrap(err).WithArgs(map[string]any{"message": MissingConfigMessage})
	}
	if err != nil {
		return TrafficDetail{}, ErrTrafficDetailUnavailable.Wrap(err).WithArgs(map[string]any{"message": UpstreamFailedMessage})
	}
	_ = s.cache.Set(ctx, TrafficCacheKey, detail, TrafficCacheTTL)
	return detail.VisibleTo(viewer), nil
}

func (s *Service) buildTraffic(ctx context.Context) (TrafficDetail, error) {
	window := NewWindow(s.now())
	raw, err := s.traffic.Traffic(ctx, window)
	if err != nil {
		return TrafficDetail{}, err
	}
	detail := TrafficDetail{
		Current:   raw.Current,
		Previous:  raw.Previous,
		Hourly:    fillHours(raw.Hourly, window),
		TopFiles:  nonNil(raw.TopFiles),
		Countries: nonNil(raw.Countries),
		TopGames:  make([]GameTraffic, 0, len(raw.TopGames)),
	}
	var gameIDs []int
	for _, entry := range raw.TopGames {
		if entry.GameID > 0 {
			gameIDs = append(gameIDs, entry.GameID)
		}
	}
	refs, err := s.stats.Games(ctx, gameIDs)
	if err != nil {
		return TrafficDetail{}, err
	}
	for _, entry := range raw.TopGames {
		traffic := GameTraffic{GameID: entry.GameID, Counter: entry.Counter}
		if ref, ok := refs[entry.GameID]; ok {
			titles := ref.Titles
			traffic.Titles = &titles
			traffic.Rated = ref.Rated
		}
		detail.TopGames = append(detail.TopGames, traffic)
	}
	var fileIDs []int
	for _, file := range detail.TopFiles {
		if id, err := strconv.Atoi(file.FileID); err == nil && id > 0 {
			fileIDs = append(fileIDs, id)
		}
	}
	rated, err := s.stats.RatedFiles(ctx, fileIDs)
	if err != nil {
		return TrafficDetail{}, err
	}
	for i, file := range detail.TopFiles {
		if id, err := strconv.Atoi(file.FileID); err == nil {
			detail.TopFiles[i].Rated = rated[id]
		}
	}
	return detail, nil
}

func fillHours(points []HourPoint, window Window) []HourPoint {
	byHour := make(map[time.Time]Counter, len(points))
	for _, point := range points {
		byHour[point.Hour.UTC().Truncate(time.Hour)] = point.Counter
	}
	filled := make([]HourPoint, 0, HourlyPoints)
	for hour := window.HourlySince; !hour.After(window.CurrentHour); hour = hour.Add(time.Hour) {
		filled = append(filled, HourPoint{Hour: hour, Counter: byHour[hour]})
	}
	return filled
}

func nonNil[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}
