package ai

import "time"

type RequestRecord struct {
	CallID       string
	Source       Source
	Scene        *string
	ModelID      *int
	RouteID      *int
	ProviderID   *int
	UpstreamID   string
	Protocol     Protocol
	OK           bool
	Failure      *Failure
	Adaptation   *string
	FinishReason *FinishReason
	FirstToken   *time.Duration
	Duration     time.Duration
	Usage        Usage
	CostUSD      float64
	Created      time.Time
	Payload      *Payload
}

type Payload struct {
	System   string
	Messages []Message
	Schema   []byte
	Output   *string
}

type Request struct {
	ID           int64
	CallID       string
	Source       Source
	Scene        *string
	Model        *ModelRef
	RouteID      *int
	Provider     *ProviderRef
	UpstreamID   string
	Protocol     Protocol
	OK           bool
	ErrorKind    *ErrorKind
	ErrorMessage *string
	Adaptation   *string
	FirstTokenMS *int
	DurationMS   int
	Usage        Usage
	CostUSD      float64
	Created      time.Time
}

type RequestDetail struct {
	Request
	ErrorDetail  *string
	FinishReason *string
	Payload      *Payload
	Attempts     []Request
}

type RequestFilter struct {
	Since      time.Time
	Scene      *string
	ModelID    *int
	ProviderID *int
	RouteID    *int
	Source     *Source
	OK         *bool
	ErrorKind  *ErrorKind
}

type Range string

const (
	RangeHour  Range = "1h"
	RangeDay   Range = "24h"
	RangeWeek  Range = "7d"
	RangeMonth Range = "30d"
)

func (r Range) Valid() bool {
	return r == RangeHour || r == RangeDay || r == RangeWeek || r == RangeMonth
}

func (r Range) Span() time.Duration {
	switch r {
	case RangeHour:
		return time.Hour
	case RangeWeek:
		return 7 * 24 * time.Hour
	case RangeMonth:
		return 30 * 24 * time.Hour
	default:
		return 24 * time.Hour
	}
}

func (r Range) Bucket() time.Duration {
	switch r {
	case RangeHour:
		return 5 * time.Minute
	case RangeDay:
		return time.Hour
	default:
		return 24 * time.Hour
	}
}

var BucketOrigin = time.Date(2000, 1, 1, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60))

func (r Range) Window(now time.Time) (first time.Time, count int) {
	bucket := r.Bucket()
	count = int((r.Span() + bucket - 1) / bucket)
	elapsed := now.Sub(BucketOrigin)
	current := BucketOrigin.Add(elapsed / bucket * bucket)
	return current.Add(-time.Duration(count-1) * bucket).UTC(), count
}

type Stats struct {
	Requests     int
	Failures     int
	FirstTokenMS *int
	CostUSD      float64
}

type Dimension string

const (
	DimensionModel    Dimension = "model"
	DimensionProvider Dimension = "provider"
	DimensionRoute    Dimension = "route"
	DimensionScene    Dimension = "scene"
)

func (d Dimension) Valid() bool {
	return d == DimensionModel || d == DimensionProvider || d == DimensionRoute || d == DimensionScene
}

type LastAttempt struct {
	ID           int64
	OK           bool
	Created      time.Time
	FirstTokenMS *int
	ErrorKind    *ErrorKind
	ErrorMessage *string
}

type RouteView struct {
	Route
	Offered *bool
	Last    *LastAttempt
	Stats   Stats
}

type ProviderView struct {
	ProviderSummary
	Stats    Stats
	LastUsed *time.Time
}

type ProviderDetail struct {
	ProviderView
	RouteViews []RouteView
}

type ModelSceneRole string

const (
	SceneRolePrimary ModelSceneRole = "primary"
	SceneRoleDefault ModelSceneRole = "default"
)

type ModelScene struct {
	Key   string
	Label string
	Role  ModelSceneRole
}

type ModelView struct {
	Model
	RouteViews []RouteView
	Scenes     []ModelScene
	Stats      Stats
}

type SeriesBucket struct {
	At           time.Time
	Requests     int
	Failures     int
	CostUSD      float64
	FirstTokenMS *int
}

type Series struct {
	Bucket  time.Duration
	Buckets []SeriesBucket
}

type ModelCost struct {
	ModelID *int
	Label   *string
	Costs   []float64
}

type CostSeries struct {
	Series
	Models []ModelCost
}

type CostBucket struct {
	At      time.Time
	ModelID *int
	CostUSD float64
}

type BreakdownRow struct {
	Key          string
	Label        string
	Routes       []string
	Stats        Stats
	DurationP95  *int
	InputTokens  int
	OutputTokens int
}

type Overview struct {
	Current  Stats
	Previous Stats
}

type RequestSummary struct {
	Stats Stats
	Series
}

type PlaygroundTargetKind string

const (
	PlaygroundScene PlaygroundTargetKind = "scene"
	PlaygroundModel PlaygroundTargetKind = "model"
	PlaygroundRoute PlaygroundTargetKind = "route"
)

func (k PlaygroundTargetKind) Valid() bool {
	return k == PlaygroundScene || k == PlaygroundModel || k == PlaygroundRoute
}

type PlaygroundTarget struct {
	Kind PlaygroundTargetKind
	ID   string
}

type PlaygroundRun struct {
	Targets         []PlaygroundTarget
	Prompt          Prompt
	Temperature     *float64
	MaxOutputTokens *int
	Schema          []byte
}

type PlaygroundResult struct {
	OK       bool
	Output   *string
	Failure  *Failure
	Attempts []Request
}

type CheckResult struct {
	Failure *Failure
	Route   RouteView
}

type RequestQuery struct {
	Range      Range
	Scene      *string
	ModelID    *int
	ProviderID *int
	RouteID    *int
	Source     *Source
	OK         *bool
	ErrorKind  *ErrorKind
}

func (q RequestQuery) filter(since time.Time) RequestFilter {
	return RequestFilter{Since: since, Scene: q.Scene, ModelID: q.ModelID, ProviderID: q.ProviderID, RouteID: q.RouteID, Source: q.Source, OK: q.OK, ErrorKind: q.ErrorKind}
}

func fillSeries(r Range, now time.Time, found []SeriesBucket) (Series, time.Time) {
	first, count := r.Window(now)
	bucket := r.Bucket()
	byStart := make(map[int64]SeriesBucket, len(found))
	for _, row := range found {
		byStart[row.At.Unix()] = row
	}
	series := Series{Bucket: bucket, Buckets: make([]SeriesBucket, count)}
	for i := range count {
		at := first.Add(time.Duration(i) * bucket)
		row := byStart[at.Unix()]
		row.At = at
		series.Buckets[i] = row
	}
	return series, first
}
