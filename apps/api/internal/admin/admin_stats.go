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
	TotalGames      int
	TotalUsers      int
	TotalDownloads  int64
	TotalViews      int64
	TotalCharacters int
	TotalDevelopers int
	TotalComments   int
	NewGamesToday   int
	NewUsersToday   int
}

type DailyCounts struct {
	Games map[string]int
	Users map[string]int
}

type TrendPoint struct {
	Date      string
	Games     int
	Users     int
	Downloads int
	Views     int
}
