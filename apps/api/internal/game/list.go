package game

import (
	"fmt"
	"slices"
	"strconv"
	"time"
)

type SortBy string

const (
	SortByReleaseDate SortBy = "release_date"
	SortByViews       SortBy = "views"
	SortByDownloads   SortBy = "downloads"
	SortByHotScore    SortBy = "hot_score"
)

type SortOrder string

const (
	SortAscending  SortOrder = "asc"
	SortDescending SortOrder = "desc"
)

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}

type ListQuery struct {
	Page        Page
	DeveloperID *int
	CharacterID *int
	Tags        []string
	ExcludeTags []string
	Platforms   []string
	Years       []int
	Months      []int
	SortBy      SortBy
	SortOrder   SortOrder
	StartDate   *time.Time
	EndDate     *time.Time
}

func (q ListQuery) entityPage() bool {
	return (q.DeveloperID != nil && *q.DeveloperID != 0) || (q.CharacterID != nil && *q.CharacterID != 0)
}

type Visibility struct {
	ExcludeRated      bool
	OnlyWithResources bool
}

type ListFilter struct {
	Visibility
	DeveloperID    *int
	CharacterID    *int
	Tags           []string
	ExcludeTags    []string
	Platforms      []string
	ReleasePeriods []string
	ReleasedAfter  *time.Time
	ReleasedBefore *time.Time
	SortBy         SortBy
	SortOrder      SortOrder
}

func ReleasePeriods(years, months []int, now time.Time) []string {
	years = uniqueSorted(years, func(int) bool { return true })
	months = uniqueSorted(months, func(month int) bool { return month >= 1 && month <= 12 })
	switch {
	case len(years) == 0 && len(months) == 0:
		return nil
	case len(years) > 0 && len(months) > 0:
		periods := make([]string, 0, len(years)*len(months))
		for _, year := range years {
			for _, month := range months {
				periods = append(periods, period(year, month))
			}
		}
		return periods
	case len(years) > 0:
		periods := make([]string, len(years))
		for i, year := range years {
			periods[i] = strconv.Itoa(year)
		}
		return periods
	default:
		periods := make([]string, len(months))
		for i, month := range months {
			periods[i] = period(now.UTC().Year(), month)
		}
		return periods
	}
}

func period(year, month int) string {
	return fmt.Sprintf("%d-%02d", year, month)
}

func uniqueSorted(values []int, keep func(int) bool) []int {
	kept := slices.DeleteFunc(slices.Clone(values), func(v int) bool { return !keep(v) })
	slices.Sort(kept)
	return slices.Compact(kept)
}
