package game

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
)

type AdminSortField string

const (
	AdminSortByID        AdminSortField = "id"
	AdminSortByTitleJP   AdminSortField = "title_jp"
	AdminSortByViews     AdminSortField = "views"
	AdminSortByDownloads AdminSortField = "downloads"
	AdminSortByCreated   AdminSortField = "created"
	AdminSortByUpdated   AdminSortField = "updated"
)

type AdminFilter struct {
	Search     string
	Status     *Status
	SortBy     AdminSortField
	Descending bool
}

type CreatorRef struct {
	ID   int
	Name string
}

type AdminEntry struct {
	ID        int
	TitleJP   string
	TitleZH   string
	TitleEN   string
	Status    Status
	Views     int
	Downloads int
	NSFW      bool
	Created   time.Time
	Updated   time.Time
	CoverURL  *string
	Creator   CreatorRef
}

type Scalar struct {
	BID            *string
	VID            *string
	TitleJP        string
	TitleZH        string
	TitleEN        string
	Aliases        []string
	IntroJP        string
	IntroZH        string
	IntroEN        string
	ReleaseDate    *time.Time
	ReleaseDateTBA bool
	ExtraInfo      json.RawMessage
	Staffs         json.RawMessage
	NSFW           bool
	Type           *string
	Platform       []string
	Status         Status
}

type ScalarChanges struct {
	BID            patch.Clearable[string]
	VID            patch.Clearable[string]
	TitleJP        *string
	TitleZH        *string
	TitleEN        *string
	Aliases        *[]string
	IntroJP        *string
	IntroZH        *string
	IntroEN        *string
	ReleaseDate    patch.Clearable[time.Time]
	ReleaseDateTBA *bool
	ExtraInfo      patch.Clearable[[]ExtraInfo]
	Staffs         patch.Clearable[[]Staff]
	NSFW           *bool
	Type           patch.Clearable[string]
	Platform       *[]string
	Status         *Status
}

func (c ScalarChanges) Empty() bool {
	return !c.BID.Set && !c.VID.Set && c.TitleJP == nil && c.TitleZH == nil && c.TitleEN == nil &&
		c.Aliases == nil && c.IntroJP == nil && c.IntroZH == nil && c.IntroEN == nil &&
		!c.ReleaseDate.Set && c.ReleaseDateTBA == nil && !c.ExtraInfo.Set && !c.Staffs.Set &&
		c.NSFW == nil && !c.Type.Set && c.Platform == nil && c.Status == nil
}

func (c ScalarChanges) normalized() ScalarChanges {
	c.BID = blankAsNull(c.BID)
	c.VID = blankAsNull(c.VID)
	c.Type = blankAsNull(c.Type)
	c.ExtraInfo = nullAsEmpty(c.ExtraInfo)
	c.Staffs = nullAsEmpty(c.Staffs)
	return c
}

func blankAsNull(value patch.Clearable[string]) patch.Clearable[string] {
	if value.Set && value.Value != nil && strings.TrimSpace(*value.Value) == "" {
		value.Value = nil
	}
	return value
}

func nullAsEmpty[T any](value patch.Clearable[[]T]) patch.Clearable[[]T] {
	if value.Set && value.Value == nil {
		empty := []T{}
		value.Value = &empty
	}
	return value
}
