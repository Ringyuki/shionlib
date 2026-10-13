package admin

import (
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
	TotalGames        int
	TotalUsers        int
	TotalDownloads    int64
	TotalViews        int64
	TotalCharacters   int
	TotalDevelopers   int
	TotalComments     int
	TotalResources    int
	NewGamesToday     int
	NewUsersToday     int
	NewResourcesToday int
	NewCommentsToday  int
	DownloadsToday    int
	ViewsToday        int
}

type DailyCounts struct {
	Games     map[string]int
	Users     map[string]int
	Downloads map[string]int
	Views     map[string]int
}

type TrendPoint struct {
	Date      string
	Games     int
	Users     int
	Downloads int
	Views     int
}

type Pending struct {
	Reports      int
	MalwareCases int
	StalledFiles int
	Comments     int
	Walkthroughs int
	AIAlerts     int
}

type Tally struct {
	Files int
	Bytes int64
}

type FileCounts struct {
	Uploading     Tally
	AwaitingCheck int
	AwaitingStore int
	Stored        Tally
}

type Storage struct {
	FileCounts
	SpoolCapacity  int64
	SpoolAvailable int64
	SpoolReserve   int64
}

func StatsDay(at time.Time) string {
	return at.UTC().Add(StatsDayOffset).Format(dateLayout)
}
