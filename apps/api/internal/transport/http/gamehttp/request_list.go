package gamehttp

import (
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
)

type listGamesInput struct {
	Page        int      `query:"page" default:"1" minimum:"1" doc:"1-based page number"`
	PageSize    int      `query:"pageSize" default:"10" minimum:"1" maximum:"100" doc:"Items per page"`
	DeveloperID int      `query:"developer_id" doc:"Only games credited to this developer; the resource setting is ignored"`
	CharacterID int      `query:"character_id" doc:"Only games featuring this character; the resource setting is ignored"`
	Tags        []string `query:"filter[tags][],explode" doc:"Games carrying any of these tags"`
	ExcludeTags []string `query:"filter[exclude_tags][],explode" doc:"Games carrying none of these tags"`
	Years       []int    `query:"filter[years][],explode" doc:"Release years (1900-2100)"`
	Months      []int    `query:"filter[months][],explode" doc:"Release months (1-12); combined with years or the current year"`
	Platforms   []string `query:"filter[platforms][],explode" doc:"Games available on any of these platforms"`
	SortBy      string   `query:"filter[sort_by]" enum:"release_date,views,downloads,hot_score" doc:"Sort key, release_date by default"`
	SortOrder   string   `query:"filter[sort_order]" enum:"asc,desc" doc:"Sort direction, desc by default"`
	StartDate   string   `query:"filter[start_date]" doc:"Released on or after this date (ISO 8601)"`
	EndDate     string   `query:"filter[end_date]" doc:"Released on or before this date (ISO 8601)"`

	startDate *time.Time
	endDate   *time.Time
}

var dateLayouts = []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"}

func parseDate(raw string) (*time.Time, bool) {
	for _, layout := range dateLayouts {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return &parsed, true
		}
	}
	return nil, false
}

func outOfRange(location string, values []int, low, high int) []error {
	var errs []error
	for _, value := range values {
		switch {
		case value < low:
			errs = append(errs, &huma.ErrorDetail{Location: location, Message: "expected number >= " + strconv.Itoa(low), Value: value})
		case value > high:
			errs = append(errs, &huma.ErrorDetail{Location: location, Message: "expected number <= " + strconv.Itoa(high), Value: value})
		}
	}
	return errs
}

func (in *listGamesInput) Resolve(_ huma.Context) []error {
	errs := append(outOfRange("query.filter[years]", in.Years, 1900, 2100), outOfRange("query.filter[months]", in.Months, 1, 12)...)
	for _, field := range []struct {
		location string
		raw      string
		target   **time.Time
	}{
		{location: "query.filter[start_date]", raw: in.StartDate, target: &in.startDate},
		{location: "query.filter[end_date]", raw: in.EndDate, target: &in.endDate},
	} {
		if field.raw == "" {
			continue
		}
		parsed, ok := parseDate(field.raw)
		if !ok {
			errs = append(errs, &huma.ErrorDetail{Location: field.location, Message: "expected string to be RFC 3339 date-time", Value: field.raw})
			continue
		}
		*field.target = parsed
	}
	return errs
}

func (in *listGamesInput) query() game.ListQuery {
	query := game.ListQuery{
		Page:        game.Page{Number: in.Page, Size: in.PageSize},
		Tags:        in.Tags,
		ExcludeTags: in.ExcludeTags,
		Platforms:   in.Platforms,
		Years:       in.Years,
		Months:      in.Months,
		SortBy:      game.SortBy(in.SortBy),
		SortOrder:   game.SortOrder(in.SortOrder),
		StartDate:   in.startDate,
		EndDate:     in.endDate,
	}
	if in.DeveloperID != 0 {
		query.DeveloperID = &in.DeveloperID
	}
	if in.CharacterID != 0 {
		query.CharacterID = &in.CharacterID
	}
	return query
}
