package ad

import "time"

const (
	MaxNameLength        = 100
	MaxImageLength       = 500
	MaxAspectLength      = 20
	MaxLinkLength        = 500
	MaxPlacementLength   = 100
	PlacementCacheTTL    = 5 * time.Minute
	PlacementCachePrefix = "ad:placement:"
)

type Ad struct {
	ID             int
	Name           string
	Placement      []string
	ImageZH        string
	ImageJA        *string
	ImageEN        *string
	Aspect         string
	Link           string
	ExcludeLocales []string
	Enabled        bool
	Sort           int
	StartAt        *time.Time
	EndAt          *time.Time
	Created        time.Time
	Updated        time.Time
}

type NewAd struct {
	Name           string
	Placement      []string
	ImageZH        string
	ImageJA        *string
	ImageEN        *string
	Aspect         string
	Link           string
	ExcludeLocales []string
	Enabled        bool
	Sort           int
	StartAt        *time.Time
	EndAt          *time.Time
}

type Clearable[T any] struct {
	Set   bool
	Value *T
}

type Changes struct {
	Name           *string
	Placement      *[]string
	ImageZH        *string
	ImageJA        Clearable[string]
	ImageEN        Clearable[string]
	Aspect         *string
	Link           *string
	ExcludeLocales *[]string
	Enabled        *bool
	Sort           *int
	StartAt        Clearable[time.Time]
	EndAt          Clearable[time.Time]
}

type SortField string

const (
	SortByID      SortField = "id"
	SortBySort    SortField = "sort"
	SortByCreated SortField = "created"
	SortByUpdated SortField = "updated"
)

type ListFilter struct {
	Placement  *string
	Enabled    *bool
	SortBy     SortField
	Descending bool
}

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}
