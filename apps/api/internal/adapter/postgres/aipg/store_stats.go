package aipg

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const metricsColumns = `count(*)::int,
  count(*) FILTER (WHERE NOT ok)::int,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY first_token_ms) FILTER (WHERE ok))::int,
  coalesce(sum(cost_usd), 0)::float8`

const filterClause = `created >= $1
  AND ($2::timestamp IS NULL OR created < $2)
  AND ($3::text IS NULL OR scene = $3)
  AND ($4::int IS NULL OR model_id = $4)
  AND ($5::int IS NULL OR provider_id = $5)
  AND ($6::int IS NULL OR route_id = $6)
  AND ($7::text IS NULL OR source = $7)
  AND ($8::bool IS NULL OR ok = $8)
  AND ($9::text IS NULL OR error_kind = $9)`

const (
	metricsQuery     = `SELECT ` + metricsColumns + ` FROM ai_requests WHERE ` + filterClause
	bucketsQuery     = `SELECT date_bin($10::interval, created, $11::timestamp) AS at, ` + metricsColumns + ` FROM ai_requests WHERE ` + filterClause + ` GROUP BY 1 ORDER BY 1`
	costBucketsQuery = `SELECT date_bin($10::interval, created, $11::timestamp) AS at, model_id, coalesce(sum(cost_usd), 0)::float8 FROM ai_requests WHERE ` + filterClause + ` GROUP BY 1, 2 ORDER BY 1, 2`
	latestQuery      = `SELECT DISTINCT ON (route_id) id, route_id, ok, created, first_token_ms, error_kind, error_message
FROM ai_requests
WHERE route_id = ANY($1)
ORDER BY route_id, created DESC, id DESC`
	lastUsedQuery = `SELECT provider_id, max(created) FROM ai_requests WHERE source = 'scene' AND provider_id IS NOT NULL GROUP BY provider_id`
)

const (
	groupedScope   = ` FROM ai_requests WHERE source = 'scene' AND created >= $1`
	breakdownExtra = `,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms))::int,
  coalesce(sum(input_tokens), 0)::bigint,
  coalesce(sum(output_tokens), 0)::bigint`
	breakdownTail = ` GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT $2`
)

var groupedQueries = map[ai.Dimension]string{
	ai.DimensionModel:    `SELECT model_id::text, ` + metricsColumns + groupedScope + ` AND model_id IS NOT NULL GROUP BY 1`,
	ai.DimensionProvider: `SELECT provider_id::text, ` + metricsColumns + groupedScope + ` AND provider_id IS NOT NULL GROUP BY 1`,
	ai.DimensionRoute:    `SELECT route_id::text, ` + metricsColumns + groupedScope + ` AND route_id IS NOT NULL GROUP BY 1`,
	ai.DimensionScene:    `SELECT scene, ` + metricsColumns + groupedScope + ` AND scene IS NOT NULL GROUP BY 1`,
}

var breakdownQueries = map[ai.Dimension]string{
	ai.DimensionModel:    `SELECT model_id::text, ` + metricsColumns + breakdownExtra + groupedScope + ` AND model_id IS NOT NULL` + breakdownTail,
	ai.DimensionProvider: `SELECT provider_id::text, ` + metricsColumns + breakdownExtra + groupedScope + ` AND provider_id IS NOT NULL` + breakdownTail,
	ai.DimensionRoute:    `SELECT route_id::text, ` + metricsColumns + breakdownExtra + groupedScope + ` AND route_id IS NOT NULL` + breakdownTail,
	ai.DimensionScene:    `SELECT scene, ` + metricsColumns + breakdownExtra + groupedScope + ` AND scene IS NOT NULL` + breakdownTail,
}

type StatsStore struct {
	client *ent.Client
}

func NewStatsStore(client *ent.Client) *StatsStore {
	return &StatsStore{client: client}
}

func (s *StatsStore) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, s.client)
}

func filterArgs(filter ai.RequestFilter, until *time.Time) []any {
	var upper *time.Time
	if until != nil {
		utc := until.UTC()
		upper = &utc
	}
	var source, errorKind *string
	if filter.Source != nil {
		value := string(*filter.Source)
		source = &value
	}
	if filter.ErrorKind != nil {
		value := string(*filter.ErrorKind)
		errorKind = &value
	}
	return []any{filter.Since.UTC(), upper, filter.Scene, filter.ModelID, filter.ProviderID, filter.RouteID, source, filter.OK, errorKind}
}

func bucketArgs(filter ai.RequestFilter, bucket time.Duration) []any {
	origin := ai.BucketOrigin.UTC().Format("2006-01-02 15:04:05")
	return append(filterArgs(filter, nil), strconv.FormatInt(int64(bucket/time.Second), 10)+" seconds", origin)
}

type metricsRow struct {
	requests   int
	failures   int
	firstToken sql.NullInt64
	cost       float64
}

func (m metricsRow) stats() ai.Stats {
	stats := ai.Stats{Requests: m.requests, Failures: m.failures, CostUSD: m.cost}
	if m.firstToken.Valid {
		value := int(m.firstToken.Int64)
		stats.FirstTokenMS = &value
	}
	return stats
}

func (m *metricsRow) targets() []any {
	return []any{&m.requests, &m.failures, &m.firstToken, &m.cost}
}

func (s *StatsStore) Grouped(ctx context.Context, dimension ai.Dimension, since time.Time) (map[string]ai.Stats, error) {
	query, ok := groupedQueries[dimension]
	if !ok {
		return nil, fmt.Errorf("unknown ai stats dimension %q", dimension)
	}
	rows, err := s.db(ctx).QueryContext(ctx, query, since.UTC())
	if err != nil {
		return nil, fmt.Errorf("group ai requests by %s: %w", dimension, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	grouped := map[string]ai.Stats{}
	for rows.Next() {
		var key string
		var metrics metricsRow
		if err := rows.Scan(append([]any{&key}, metrics.targets()...)...); err != nil {
			return nil, fmt.Errorf("scan ai request group: %w", err)
		}
		grouped[key] = metrics.stats()
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai request groups: %w", err)
	}
	return grouped, nil
}

func (s *StatsStore) LatestAttempts(ctx context.Context, routeIDs []int) (map[int]ai.LastAttempt, error) {
	latest := map[int]ai.LastAttempt{}
	if len(routeIDs) == 0 {
		return latest, nil
	}
	rows, err := s.db(ctx).QueryContext(ctx, latestQuery, pgvalue.Ints(routeIDs))
	if err != nil {
		return nil, fmt.Errorf("load latest ai attempts: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var (
			attempt    ai.LastAttempt
			routeID    int
			firstToken sql.NullInt64
			kind       sql.NullString
			message    sql.NullString
		)
		if err := rows.Scan(&attempt.ID, &routeID, &attempt.OK, &attempt.Created, &firstToken, &kind, &message); err != nil {
			return nil, fmt.Errorf("scan latest ai attempt: %w", err)
		}
		attempt.Created = attempt.Created.UTC()
		if firstToken.Valid {
			value := int(firstToken.Int64)
			attempt.FirstTokenMS = &value
		}
		if kind.Valid {
			value := ai.ErrorKind(kind.String)
			attempt.ErrorKind = &value
		}
		if message.Valid {
			attempt.ErrorMessage = &message.String
		}
		latest[routeID] = attempt
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read latest ai attempts: %w", err)
	}
	return latest, nil
}

func (s *StatsStore) LastUsed(ctx context.Context) (map[int]time.Time, error) {
	rows, err := s.db(ctx).QueryContext(ctx, lastUsedQuery)
	if err != nil {
		return nil, fmt.Errorf("load ai provider usage: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	used := map[int]time.Time{}
	for rows.Next() {
		var id int
		var at time.Time
		if err := rows.Scan(&id, &at); err != nil {
			return nil, fmt.Errorf("scan ai provider usage: %w", err)
		}
		used[id] = at.UTC()
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai provider usage: %w", err)
	}
	return used, nil
}

func (s *StatsStore) Metrics(ctx context.Context, filter ai.RequestFilter, until time.Time) (ai.Stats, error) {
	rows, err := s.db(ctx).QueryContext(ctx, metricsQuery, filterArgs(filter, &until)...)
	if err != nil {
		return ai.Stats{}, fmt.Errorf("aggregate ai requests: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	var metrics metricsRow
	if rows.Next() {
		if err := rows.Scan(metrics.targets()...); err != nil {
			return ai.Stats{}, fmt.Errorf("scan ai request metrics: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return ai.Stats{}, fmt.Errorf("read ai request metrics: %w", err)
	}
	return metrics.stats(), nil
}

func (s *StatsStore) Buckets(ctx context.Context, filter ai.RequestFilter, bucket time.Duration) ([]ai.SeriesBucket, error) {
	rows, err := s.db(ctx).QueryContext(ctx, bucketsQuery, bucketArgs(filter, bucket)...)
	if err != nil {
		return nil, fmt.Errorf("bucket ai requests: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	buckets := []ai.SeriesBucket{}
	for rows.Next() {
		var at time.Time
		var metrics metricsRow
		if err := rows.Scan(append([]any{&at}, metrics.targets()...)...); err != nil {
			return nil, fmt.Errorf("scan ai request bucket: %w", err)
		}
		stats := metrics.stats()
		buckets = append(buckets, ai.SeriesBucket{At: at.UTC(), Requests: stats.Requests, Failures: stats.Failures, CostUSD: stats.CostUSD, FirstTokenMS: stats.FirstTokenMS})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai request buckets: %w", err)
	}
	return buckets, nil
}

func (s *StatsStore) CostBuckets(ctx context.Context, filter ai.RequestFilter, bucket time.Duration) ([]ai.CostBucket, error) {
	rows, err := s.db(ctx).QueryContext(ctx, costBucketsQuery, bucketArgs(filter, bucket)...)
	if err != nil {
		return nil, fmt.Errorf("bucket ai request costs: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()
	buckets := []ai.CostBucket{}
	for rows.Next() {
		var row ai.CostBucket
		var model sql.NullInt64
		if err := rows.Scan(&row.At, &model, &row.CostUSD); err != nil {
			return nil, fmt.Errorf("scan ai cost bucket: %w", err)
		}
		row.At = row.At.UTC()
		if model.Valid {
			id := int(model.Int64)
			row.ModelID = &id
		}
		buckets = append(buckets, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai cost buckets: %w", err)
	}
	return buckets, nil
}

func (s *StatsStore) Breakdown(ctx context.Context, dimension ai.Dimension, since time.Time, limit int) ([]ai.BreakdownRow, error) {
	query, ok := breakdownQueries[dimension]
	if !ok {
		return nil, fmt.Errorf("unknown ai stats dimension %q", dimension)
	}
	rows, err := s.db(ctx).QueryContext(ctx, query, since.UTC(), limit)
	if err != nil {
		return nil, fmt.Errorf("break down ai requests by %s: %w", dimension, err)
	}
	defer func() {
		_ = rows.Close()
	}()
	breakdown := []ai.BreakdownRow{}
	for rows.Next() {
		var row ai.BreakdownRow
		var metrics metricsRow
		var p95 sql.NullInt64
		targets := append([]any{&row.Key}, metrics.targets()...)
		if err := rows.Scan(append(targets, &p95, &row.InputTokens, &row.OutputTokens)...); err != nil {
			return nil, fmt.Errorf("scan ai request breakdown: %w", err)
		}
		row.Stats = metrics.stats()
		if p95.Valid {
			value := int(p95.Int64)
			row.DurationP95 = &value
		}
		breakdown = append(breakdown, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read ai request breakdown: %w", err)
	}
	return breakdown, nil
}
