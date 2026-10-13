package ad

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

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

type Changes struct {
	Name           *string
	Placement      *[]string
	ImageZH        *string
	ImageJA        patch.Clearable[string]
	ImageEN        patch.Clearable[string]
	Aspect         *string
	Link           *string
	ExcludeLocales *[]string
	Enabled        *bool
	Sort           *int
	StartAt        patch.Clearable[time.Time]
	EndAt          patch.Clearable[time.Time]
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

type Page = paging.Page
