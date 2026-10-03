package cloudflare_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/cloudflare"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
)

type recorder struct {
	mu      sync.Mutex
	queries []string
	auth    []string
}

func engine(t *testing.T, respond func(query string) string) (*httptest.Server, *recorder) {
	t.Helper()
	rec := &recorder{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		rec.mu.Lock()
		rec.queries = append(rec.queries, r.URL.Path+" "+r.Header.Get("Content-Type")+" "+string(raw))
		rec.auth = append(rec.auth, r.Header.Get("Authorization"))
		rec.mu.Unlock()
		_, _ = w.Write([]byte(respond(string(raw))))
	}))
	t.Cleanup(server.Close)
	return server, rec
}

func TestEngineBytesServed(t *testing.T) {
	server, rec := engine(t, func(string) string { return `{"data":[{"totalBytes":"12345"}],"meta":[],"rows":1}` })
	client := cloudflare.NewAnalytics(server.Client(), cloudflare.Options{BaseURL: server.URL, AccountID: "acc", Secret: "sec", UseAnalyticsEngine: true})
	since := time.Date(2026, 10, 2, 12, 34, 56, 789_000_000, time.UTC)
	bytes, err := client.BytesServed(context.Background(), since, since.Add(24*time.Hour))
	if err != nil || bytes != 12345 {
		t.Fatalf("bytes: %d %v", bytes, err)
	}
	if rec.queries[0] != "/accounts/acc/analytics_engine/sql text/plain SELECT SUM(double1) AS totalBytes FROM shionlib_downloads WHERE timestamp >= toDateTime('2026-10-02 12:34:56')" || rec.auth[0] != "Bearer sec" {
		t.Fatalf("unexpected query %q %q", rec.queries[0], rec.auth[0])
	}
	unconfigured := cloudflare.NewAnalytics(server.Client(), cloudflare.Options{BaseURL: server.URL, UseAnalyticsEngine: true})
	if _, err := unconfigured.BytesServed(context.Background(), since, since); !errors.Is(err, analysis.ErrNotConfigured) {
		t.Fatalf("missing config: %v", err)
	}
}

func TestZoneBytesServed(t *testing.T) {
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.URL.Path != "/graphql" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(`{"data":{"viewer":{"zones":[{"httpRequestsAdaptiveGroups":[{"sum":{"edgeResponseBytes":100}},{"sum":{"edgeResponseBytes":23}}]}]}},"errors":null}`))
	}))
	t.Cleanup(server.Close)
	client := cloudflare.NewAnalytics(server.Client(), cloudflare.Options{BaseURL: server.URL, ZoneID: "zone", Secret: "sec"})
	until := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	bytes, err := client.BytesServed(context.Background(), until.Add(-24*time.Hour), until)
	if err != nil || bytes != 123 {
		t.Fatalf("zone bytes: %d %v", bytes, err)
	}
	variables := body["variables"].(map[string]any)
	filter := variables["filter"].(map[string]any)
	if variables["zoneTag"] != "zone" || filter["requestSource"] != "eyeball" || filter["datetime_lt"] != "2026-10-03T00:00:00Z" {
		t.Fatalf("unexpected variables %+v", variables)
	}

	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":null,"errors":[{"message":"zone not found"}]}`))
	}))
	t.Cleanup(failing.Close)
	_, err = cloudflare.NewAnalytics(failing.Client(), cloudflare.Options{BaseURL: failing.URL, ZoneID: "z", Secret: "s"}).BytesServed(context.Background(), until, until)
	if err == nil || !strings.Contains(err.Error(), "zone not found") {
		t.Fatalf("graphql errors surface: %v", err)
	}
	if _, err := cloudflare.NewAnalytics(failing.Client(), cloudflare.Options{}).BytesServed(context.Background(), until, until); !errors.Is(err, analysis.ErrNotConfigured) {
		t.Fatalf("missing zone config: %v", err)
	}
}

func TestTraffic(t *testing.T) {
	server, rec := engine(t, func(query string) string {
		switch {
		case strings.Contains(query, "timestamp < toDateTime"):
			return `{"data":[{"downloadCount":"1","totalBytes":"5"}]}`
		case strings.Contains(query, "toStartOfHour"):
			return `{"data":[{"hour":"2026-10-03 10:00:00","downloadCount":"2","totalBytes":"7"}]}`
		case strings.Contains(query, "index1"):
			return `{"data":[{"fileId":"42","fileName":"game.zip","downloadCount":"3","totalBytes":9.4}]}`
		case strings.Contains(query, "blob3"):
			return `{"data":[{"country":"JP","downloadCount":"4","totalBytes":"8"}]}`
		case strings.Contains(query, "blob2"):
			return `{"data":[{"gameId":"7","downloadCount":"5","totalBytes":"6"},{"gameId":"","downloadCount":"1","totalBytes":"1"}]}`
		default:
			return `{"data":[{"downloadCount":"10","totalBytes":"100"}]}`
		}
	})
	client := cloudflare.NewAnalytics(server.Client(), cloudflare.Options{BaseURL: server.URL, AccountID: "acc", Secret: "sec"})
	window := analysis.NewWindow(time.Date(2026, 10, 3, 12, 30, 0, 0, time.UTC))
	raw, err := client.Traffic(context.Background(), window)
	if err != nil {
		t.Fatal(err)
	}
	if len(rec.queries) != 6 {
		t.Fatalf("six queries are sent: %d", len(rec.queries))
	}
	if raw.Current.DownloadCount != 10 || raw.Previous.TotalBytes != 5 || len(raw.Hourly) != 1 || !raw.Hourly[0].Hour.Equal(time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected totals %+v", raw)
	}
	if raw.TopFiles[0].FileID != "42" || raw.TopFiles[0].TotalBytes != 9 || raw.Countries[0].Country != "JP" || len(raw.TopGames) != 1 || raw.TopGames[0].GameID != 7 {
		t.Fatalf("unexpected breakdowns %+v", raw)
	}
	for _, query := range rec.queries {
		if strings.Contains(query, "toStartOfHour") && !strings.Contains(query, "toDateTime('2026-10-02 13:00:00')") {
			t.Fatalf("hourly buckets start 23 hours before the current hour: %s", query)
		}
	}
	broken := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
	t.Cleanup(broken.Close)
	if _, err := cloudflare.NewAnalytics(broken.Client(), cloudflare.Options{BaseURL: broken.URL, AccountID: "a", Secret: "s"}).Traffic(context.Background(), window); err == nil {
		t.Fatal("upstream failures surface")
	}
	if _, err := cloudflare.NewAnalytics(broken.Client(), cloudflare.Options{}).Traffic(context.Background(), window); !errors.Is(err, analysis.ErrNotConfigured) {
		t.Fatalf("missing config: %v", err)
	}
}
