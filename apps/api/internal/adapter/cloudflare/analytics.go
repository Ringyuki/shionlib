package cloudflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
)

const (
	DefaultBaseURL   = "https://api.cloudflare.com/client/v4"
	maxResponseBytes = 4 << 20
	clickhouseTime   = "2006-01-02 15:04:05"
	dataset          = "shionlib_downloads"
	zoneQuery        = `query ZoneTrafficLast24h($zoneTag: string, $filter: filter) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(limit: 2000, orderBy: [datetimeHour_ASC], filter: $filter) {
        dimensions { datetimeHour }
        count
        sum { visits edgeResponseBytes }
      }
    }
  }
}`
)

type Options struct {
	BaseURL            string
	AccountID          string
	Secret             string
	ZoneID             string
	UseAnalyticsEngine bool
}

type Analytics struct {
	http *http.Client
	opts Options
}

func NewAnalytics(httpClient *http.Client, opts Options) *Analytics {
	if opts.BaseURL == "" {
		opts.BaseURL = DefaultBaseURL
	}
	opts.BaseURL = strings.TrimSuffix(opts.BaseURL, "/")
	return &Analytics{http: httpClient, opts: opts}
}

func (a *Analytics) BytesServed(ctx context.Context, since, until time.Time) (int64, error) {
	if a.opts.UseAnalyticsEngine {
		return a.engineBytes(ctx, since)
	}
	return a.zoneBytes(ctx, since, until)
}

func (a *Analytics) engineBytes(ctx context.Context, since time.Time) (int64, error) {
	var rows []struct {
		TotalBytes number `json:"totalBytes"`
	}
	query := fmt.Sprintf("SELECT SUM(double1) AS totalBytes FROM %s WHERE timestamp >= toDateTime('%s')", dataset, stamp(since))
	if err := a.sql(ctx, query, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].TotalBytes.int(), nil
}

type graphqlResponse struct {
	Data *struct {
		Viewer struct {
			Zones []struct {
				Groups []struct {
					Sum struct {
						EdgeResponseBytes number `json:"edgeResponseBytes"`
					} `json:"sum"`
				} `json:"httpRequestsAdaptiveGroups"`
			} `json:"zones"`
		} `json:"viewer"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func (a *Analytics) zoneBytes(ctx context.Context, since, until time.Time) (int64, error) {
	if a.opts.ZoneID == "" || a.opts.Secret == "" {
		return 0, analysis.ErrNotConfigured
	}
	payload := map[string]any{
		"query": zoneQuery,
		"variables": map[string]any{
			"zoneTag": a.opts.ZoneID,
			"filter": map[string]any{
				"datetime_geq":  since.UTC().Format(time.RFC3339),
				"datetime_lt":   until.UTC().Format(time.RFC3339),
				"requestSource": "eyeball",
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("encode cloudflare graphql query: %w", err)
	}
	var response graphqlResponse
	if err := a.post(ctx, a.opts.BaseURL+"/graphql", "application/json", raw, &response); err != nil {
		return 0, err
	}
	if len(response.Errors) > 0 {
		messages := make([]string, len(response.Errors))
		for i, e := range response.Errors {
			messages[i] = e.Message
		}
		return 0, fmt.Errorf("cloudflare graphql error: %s", strings.Join(messages, "; "))
	}
	var total int64
	if response.Data != nil {
		for _, zone := range response.Data.Viewer.Zones {
			for _, group := range zone.Groups {
				total += group.Sum.EdgeResponseBytes.int()
			}
		}
	}
	return total, nil
}

type counterRow struct {
	DownloadCount number `json:"downloadCount"`
	TotalBytes    number `json:"totalBytes"`
}

func (r counterRow) counter() analysis.Counter {
	return analysis.Counter{DownloadCount: r.DownloadCount.int(), TotalBytes: r.TotalBytes.int()}
}

func (a *Analytics) Traffic(ctx context.Context, window analysis.Window) (analysis.RawTraffic, error) {
	if a.opts.AccountID == "" || a.opts.Secret == "" {
		return analysis.RawTraffic{}, analysis.ErrNotConfigured
	}
	since24h, since48h, hourly := stamp(window.Since24h), stamp(window.Since48h), stamp(window.HourlySince)
	var (
		current, previous []counterRow
		hours             []struct {
			counterRow
			Hour string `json:"hour"`
		}
		files []struct {
			counterRow
			FileID   text `json:"fileId"`
			FileName text `json:"fileName"`
		}
		countries []struct {
			counterRow
			Country text `json:"country"`
		}
		games []struct {
			counterRow
			GameID text `json:"gameId"`
		}
	)
	aggregate := "COUNT(DISTINCT blob4) AS downloadCount, SUM(double1) AS totalBytes"
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(6)
	queries := map[string]any{
		fmt.Sprintf("SELECT %s FROM %s WHERE timestamp >= toDateTime('%s')", aggregate, dataset, since24h):                                                                                                  &current,
		fmt.Sprintf("SELECT %s FROM %s WHERE timestamp >= toDateTime('%s') AND timestamp < toDateTime('%s')", aggregate, dataset, since48h, since24h):                                                       &previous,
		fmt.Sprintf("SELECT toStartOfHour(timestamp) AS hour, %s FROM %s WHERE timestamp >= toDateTime('%s') GROUP BY hour ORDER BY hour ASC", aggregate, dataset, hourly):                                  &hours,
		fmt.Sprintf("SELECT index1 AS fileId, blob1 AS fileName, %s FROM %s WHERE timestamp >= toDateTime('%s') GROUP BY fileId, fileName ORDER BY totalBytes DESC LIMIT 10", aggregate, dataset, since24h): &files,
		fmt.Sprintf("SELECT blob3 AS country, %s FROM %s WHERE timestamp >= toDateTime('%s') AND blob3 != '' GROUP BY country ORDER BY totalBytes DESC LIMIT 20", aggregate, dataset, since24h):             &countries,
		fmt.Sprintf("SELECT blob2 AS gameId, %s FROM %s WHERE timestamp >= toDateTime('%s') AND blob2 != '' GROUP BY gameId ORDER BY totalBytes DESC LIMIT 10", aggregate, dataset, since24h):               &games,
	}
	for query, target := range queries {
		group.Go(func() error {
			return a.sql(groupCtx, query, target)
		})
	}
	if err := group.Wait(); err != nil {
		return analysis.RawTraffic{}, err
	}
	raw := analysis.RawTraffic{
		Hourly:    make([]analysis.HourPoint, 0, len(hours)),
		TopFiles:  make([]analysis.FileTraffic, 0, len(files)),
		Countries: make([]analysis.CountryTraffic, 0, len(countries)),
		TopGames:  make([]analysis.RawGameTraffic, 0, len(games)),
	}
	if len(current) > 0 {
		raw.Current = current[0].counter()
	}
	if len(previous) > 0 {
		raw.Previous = previous[0].counter()
	}
	for _, row := range hours {
		hour, err := time.ParseInLocation(clickhouseTime, row.Hour, time.UTC)
		if err != nil {
			continue
		}
		raw.Hourly = append(raw.Hourly, analysis.HourPoint{Hour: hour, Counter: row.counter()})
	}
	for _, row := range files {
		raw.TopFiles = append(raw.TopFiles, analysis.FileTraffic{FileID: string(row.FileID), FileName: string(row.FileName), Counter: row.counter()})
	}
	for _, row := range countries {
		raw.Countries = append(raw.Countries, analysis.CountryTraffic{Country: string(row.Country), Counter: row.counter()})
	}
	for _, row := range games {
		if row.GameID == "" {
			continue
		}
		id, _ := strconv.Atoi(string(row.GameID))
		raw.TopGames = append(raw.TopGames, analysis.RawGameTraffic{GameID: id, Counter: row.counter()})
	}
	return raw, nil
}

func (a *Analytics) sql(ctx context.Context, query string, target any) error {
	if a.opts.AccountID == "" || a.opts.Secret == "" {
		return analysis.ErrNotConfigured
	}
	var response struct {
		Data json.RawMessage `json:"data"`
	}
	endpoint := fmt.Sprintf("%s/accounts/%s/analytics_engine/sql", a.opts.BaseURL, a.opts.AccountID)
	if err := a.post(ctx, endpoint, "text/plain", []byte(query), &response); err != nil {
		return err
	}
	if len(response.Data) == 0 || string(response.Data) == "null" {
		return nil
	}
	if err := json.Unmarshal(response.Data, target); err != nil {
		return fmt.Errorf("decode analytics engine rows: %w", err)
	}
	return nil
}

func (a *Analytics) post(ctx context.Context, endpoint, contentType string, body []byte, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build cloudflare request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+a.opts.Secret)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Accept", "application/json")
	resp, err := a.http.Do(req)
	if err != nil {
		return fmt.Errorf("cloudflare request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return fmt.Errorf("read cloudflare response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("cloudflare returned %d", resp.StatusCode)
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode cloudflare response: %w", err)
	}
	return nil
}

func stamp(t time.Time) string {
	return t.UTC().Format(clickhouseTime)
}

type number float64

func (n *number) UnmarshalJSON(raw []byte) error {
	text := strings.Trim(strings.TrimSpace(string(raw)), `"`)
	if text == "" || text == "null" {
		*n = 0
		return nil
	}
	value, err := strconv.ParseFloat(text, 64)
	*n = 0
	if err == nil && !math.IsNaN(value) && !math.IsInf(value, 0) {
		*n = number(value)
	}
	return nil
}

func (n number) int() int64 {
	return int64(math.Round(float64(n)))
}

type text string

func (t *text) UnmarshalJSON(raw []byte) error {
	trimmed := strings.TrimSpace(string(raw))
	switch {
	case trimmed == "null":
		*t = ""
		return nil
	case strings.HasPrefix(trimmed, `"`):
		var value string
		if err := json.Unmarshal(raw, &value); err != nil {
			return err
		}
		*t = text(value)
		return nil
	default:
		*t = text(trimmed)
		return nil
	}
}
