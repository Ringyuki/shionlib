package analysis

import (
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

const (
	OverviewCacheKey      = "analysis:data:overview"
	OverviewCacheTTL      = 30 * time.Minute
	TrafficCacheKey       = "analysis:data:traffic-detail"
	TrafficCacheTTL       = 10 * time.Minute
	HourlyPoints          = 24
	MissingConfigMessage  = "Cloudflare config missing (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_ANALYTICS_SECRET)"
	UpstreamFailedMessage = "upstream request failed"
)

type Totals struct {
	Games        int
	Files        int
	Resources    int
	StorageBytes int64
}

type Overview struct {
	Totals
	BytesServed int64
}

type Counter struct {
	DownloadCount int64
	TotalBytes    int64
}

func (c Counter) AverageSize() int64 {
	if c.DownloadCount <= 0 {
		return 0
	}
	return int64(float64(c.TotalBytes)/float64(c.DownloadCount) + 0.5)
}

type HourPoint struct {
	Hour time.Time
	Counter
}

type FileTraffic struct {
	FileID   string
	FileName string
	Counter
	Rated bool
}

type CountryTraffic struct {
	Country string
	Counter
}

type GameTitles struct {
	JP string
	ZH string
	EN string
}

type GameRef struct {
	Titles GameTitles
	Rated  bool
}

type GameTraffic struct {
	GameID int
	Titles *GameTitles
	Counter
	Rated bool
}

type RawGameTraffic struct {
	GameID int
	Counter
}

type RawTraffic struct {
	Current   Counter
	Previous  Counter
	Hourly    []HourPoint
	TopFiles  []FileTraffic
	Countries []CountryTraffic
	TopGames  []RawGameTraffic
}

type TrafficDetail struct {
	Current   Counter
	Previous  Counter
	Hourly    []HourPoint
	TopFiles  []FileTraffic
	Countries []CountryTraffic
	TopGames  []GameTraffic
}

func (d TrafficDetail) VisibleTo(viewer actor.Actor) TrafficDetail {
	if viewer.IncludesRated() {
		return d
	}
	visible := d
	visible.TopFiles = slices.DeleteFunc(slices.Clone(d.TopFiles), func(f FileTraffic) bool { return f.Rated })
	visible.TopGames = slices.DeleteFunc(slices.Clone(d.TopGames), func(g GameTraffic) bool { return g.Rated })
	return visible
}

type Window struct {
	Until       time.Time
	Since24h    time.Time
	Since48h    time.Time
	HourlySince time.Time
	CurrentHour time.Time
}

func NewWindow(now time.Time) Window {
	now = now.UTC()
	current := now.Truncate(time.Hour)
	return Window{
		Until:       now,
		Since24h:    now.Add(-24 * time.Hour),
		Since48h:    now.Add(-48 * time.Hour),
		HourlySince: current.Add(-(HourlyPoints - 1) * time.Hour),
		CurrentHour: current,
	}
}
