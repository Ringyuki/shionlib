package ai

import (
	"cmp"
	"context"
	"slices"
	"strconv"
	"strings"
	"time"
)

type UsageOptions struct {
	RequestRetention time.Duration
	PayloadRetention time.Duration
	BreakdownLimit   int
	CostSeries       int
}

type UsageDeps struct {
	Gateway  *Service
	Repo     Repository
	Requests RequestLog
	Stats    StatsStore
	Now      func() time.Time
	Options  UsageOptions
}

type UsageService struct {
	gateway  *Service
	repo     Repository
	requests RequestLog
	stats    StatsStore
	now      func() time.Time
	options  UsageOptions
}

func NewUsageService(deps UsageDeps) *UsageService {
	return &UsageService{gateway: deps.Gateway, repo: deps.Repo, requests: deps.Requests, stats: deps.Stats, now: deps.Now, options: deps.Options}
}

func (s *UsageService) Overview(ctx context.Context, r Range) (Overview, error) {
	now, span, source := s.now(), r.Span(), SourceScene
	current, err := s.stats.Metrics(ctx, RequestFilter{Since: now.Add(-span), Source: &source}, now)
	if err != nil {
		return Overview{}, err
	}
	previous, err := s.stats.Metrics(ctx, RequestFilter{Since: now.Add(-2 * span), Source: &source}, now.Add(-span))
	if err != nil {
		return Overview{}, err
	}
	return Overview{Current: current, Previous: previous}, nil
}

func (s *UsageService) Costs(ctx context.Context, r Range, providerID, modelID *int) (CostSeries, error) {
	source := SourceScene
	filter := RequestFilter{Source: &source, ProviderID: providerID, ModelID: modelID}
	series, first, err := s.series(ctx, r, filter)
	if err != nil {
		return CostSeries{}, err
	}
	filter.Since = first
	rows, err := s.stats.CostBuckets(ctx, filter, r.Bucket())
	if err != nil {
		return CostSeries{}, err
	}
	totals := map[int]float64{}
	for _, row := range rows {
		if row.ModelID != nil {
			totals[*row.ModelID] += row.CostUSD
		}
	}
	var top []int
	for id, total := range totals {
		if total > 0 {
			top = append(top, id)
		}
	}
	slices.SortFunc(top, func(a, b int) int { return cmp.Or(cmp.Compare(totals[b], totals[a]), cmp.Compare(a, b)) })
	top = top[:min(len(top), max(s.options.CostSeries, 1))]
	labels, err := s.modelLabels(ctx)
	if err != nil {
		return CostSeries{}, err
	}
	costs := CostSeries{Series: series}
	position := map[int]int{}
	for i, id := range top {
		modelID := id
		label := labels[id]
		costs.Models = append(costs.Models, ModelCost{ModelID: &modelID, Label: &label, Costs: make([]float64, len(series.Buckets))})
		position[id] = i
	}
	other := ModelCost{Costs: make([]float64, len(series.Buckets))}
	for _, row := range rows {
		index := int(row.At.Sub(first) / series.Bucket)
		if index < 0 || index >= len(series.Buckets) {
			continue
		}
		if row.ModelID != nil {
			if i, ok := position[*row.ModelID]; ok {
				costs.Models[i].Costs[index] += row.CostUSD
				continue
			}
		}
		other.Costs[index] += row.CostUSD
	}
	if slices.ContainsFunc(other.Costs, func(cost float64) bool { return cost > 0 }) {
		costs.Models = append(costs.Models, other)
	}
	if costs.Models == nil {
		costs.Models = []ModelCost{}
	}
	return costs, nil
}

func (s *UsageService) Breakdown(ctx context.Context, r Range, dimension Dimension) ([]BreakdownRow, error) {
	rows, err := s.stats.Breakdown(ctx, dimension, s.now().Add(-r.Span()), max(s.options.BreakdownLimit, 1))
	if err != nil {
		return nil, err
	}
	labels, routes, err := s.breakdownLabels(ctx, dimension)
	if err != nil {
		return nil, err
	}
	for i, row := range rows {
		rows[i].Label = row.Key
		if label, ok := labels[row.Key]; ok {
			rows[i].Label = label
		}
		rows[i].Routes = routes[row.Key]
		if rows[i].Routes == nil {
			rows[i].Routes = []string{}
		}
	}
	return rows, nil
}

func (s *UsageService) Requests(ctx context.Context, query RequestQuery, page Page) ([]Request, int, error) {
	return s.requests.ListRequests(ctx, query.filter(s.now().Add(-query.Range.Span())), page)
}

func (s *UsageService) Summary(ctx context.Context, query RequestQuery) (RequestSummary, error) {
	now := s.now()
	filter := query.filter(now.Add(-query.Range.Span()))
	stats, err := s.stats.Metrics(ctx, filter, now)
	if err != nil {
		return RequestSummary{}, err
	}
	series, _, err := s.series(ctx, query.Range, filter)
	if err != nil {
		return RequestSummary{}, err
	}
	return RequestSummary{Stats: stats, Series: series}, nil
}

func (s *UsageService) Request(ctx context.Context, id int64) (RequestDetail, error) {
	detail, err := s.requests.GetRequest(ctx, id)
	if err != nil {
		return RequestDetail{}, err
	}
	if detail.Attempts, err = s.requests.Attempts(ctx, detail.CallID); err != nil {
		return RequestDetail{}, err
	}
	return detail, nil
}

func (s *UsageService) Purge(ctx context.Context) error {
	now := s.now()
	if _, err := s.requests.PurgeRequests(ctx, now.Add(-s.options.RequestRetention)); err != nil {
		return err
	}
	_, err := s.requests.PurgePayloads(ctx, now.Add(-s.options.PayloadRetention))
	return err
}

func (s *UsageService) series(ctx context.Context, r Range, filter RequestFilter) (Series, time.Time, error) {
	first, _ := r.Window(s.now())
	filter.Since = first
	found, err := s.stats.Buckets(ctx, filter, r.Bucket())
	if err != nil {
		return Series{}, time.Time{}, err
	}
	series, first := fillSeries(r, s.now(), found)
	return series, first, nil
}

func (s *UsageService) modelLabels(ctx context.Context) (map[int]string, error) {
	models, err := s.repo.ListModels(ctx)
	if err != nil {
		return nil, err
	}
	labels := make(map[int]string, len(models))
	for _, model := range models {
		labels[model.ID] = model.Name
	}
	return labels, nil
}

func (s *UsageService) breakdownLabels(ctx context.Context, dimension Dimension) (map[string]string, map[string][]string, error) {
	labels, routes := map[string]string{}, map[string][]string{}
	switch dimension {
	case DimensionScene:
		for _, scene := range s.gateway.Scenes() {
			labels[scene.Key] = scene.Label
		}
	case DimensionProvider:
		providers, err := s.repo.ListProviders(ctx)
		if err != nil {
			return nil, nil, err
		}
		for _, provider := range providers {
			labels[strconv.Itoa(provider.ID)] = provider.Name
		}
	case DimensionModel, DimensionRoute:
		all, err := s.repo.ListRoutes(ctx, RouteFilter{})
		if err != nil {
			return nil, nil, err
		}
		models, err := s.modelLabels(ctx)
		if err != nil {
			return nil, nil, err
		}
		for id, name := range models {
			if dimension == DimensionModel {
				labels[strconv.Itoa(id)] = name
			}
		}
		for _, route := range all {
			if dimension == DimensionRoute {
				labels[strconv.Itoa(route.ID)] = strings.Join([]string{route.Model.Name, route.Provider.Name}, " · ")
				continue
			}
			key := strconv.Itoa(route.Model.ID)
			routes[key] = append(routes[key], route.Provider.Name)
		}
	}
	return labels, routes, nil
}
