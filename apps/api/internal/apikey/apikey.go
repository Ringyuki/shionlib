package apikey

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	SecretPrefix      = "shl_"
	SecretBytes       = 32
	ShownPrefixLength = 12
	MaxNameLength     = 50
	MaxReasonLength   = 200
	TouchInterval     = 5 * time.Minute
	UsageRetention    = 90 * 24 * time.Hour
	RecentDays        = 7
	DetailDays        = 30
	FlushDays         = 2
	MaxLimit          = 1_000_000
	secretLength      = 43
)

type Status int

const (
	StatusActive    Status = 1
	StatusSuspended Status = 2
)

type Key struct {
	ID              int
	UserID          int
	Name            string
	Prefix          string
	Status          Status
	SuspendedReason *string
	SuspendedAt     *time.Time
	LastUsedAt      *time.Time
	LastUsedIP      *string
	Created         time.Time
}

func (k Key) Suspended() bool {
	return k.Status == StatusSuspended
}

type NewKey struct {
	UserID     int
	Name       string
	Prefix     string
	SecretHash string
}

type Issued struct {
	Key    Key
	Secret string
}

type Holder struct {
	KeyID  int
	UserID int
	Limit  *int
}

type Owner struct {
	Banned bool
	Limit  *int
}

type Mine struct {
	Keys    []Key
	Limit   int
	Enabled bool
}

type Count struct {
	KeyID     int
	Day       time.Time
	Requests  int
	Throttled int
}

type Day struct {
	Day       time.Time
	Requests  int
	Throttled int
}

type Usage struct {
	Requests  int
	Throttled int
}

type Listed struct {
	Key
	Owner  user.Summary
	Recent Usage
}

type Detail struct {
	Listed
	Days         []Day
	Total        Usage
	AccountLimit *int
	Others       []Key
}

type Summary struct {
	Today     int
	Throttled int
	Used      int
	Total     int
	Enabled   bool
}

type Sort string

const (
	SortRequests Sort = "requests"
	SortUsed     Sort = "used"
	SortCreated  Sort = "created"
)

type Filter struct {
	Status *Status
	Query  string
	UserID *int
	Sort   Sort
	Since  time.Time
}

var dayZone = time.FixedZone("UTC+8", 8*60*60)

func DayOf(at time.Time) time.Time {
	local := at.In(dayZone)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

func daysUpTo(today time.Time, count int) []time.Time {
	days := make([]time.Time, count)
	for i := range count {
		days[i] = today.AddDate(0, 0, i-count+1)
	}
	return days
}

func filled(days []Day, today time.Time, count int) []Day {
	byDay := make(map[time.Time]Day, len(days))
	for _, day := range days {
		byDay[day.Day] = day
	}
	out := make([]Day, count)
	for i, day := range daysUpTo(today, count) {
		found, ok := byDay[day]
		if !ok {
			found = Day{Day: day}
		}
		out[i] = found
	}
	return out
}

func hashOf(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}
