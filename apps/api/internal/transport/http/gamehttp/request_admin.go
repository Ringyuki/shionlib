package gamehttp

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adminGamePathInput struct {
	ID int `path:"id" minimum:"1"`
}

type adminGameListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the Japanese, Chinese or English title"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,title_jp,views,downloads,created,updated"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
	Status    int    `query:"status" enum:"1,2" doc:"1 visible, 2 hidden"`
}

func (in *adminGameListInput) filter() game.AdminFilter {
	filter := game.AdminFilter{Search: in.Search, SortBy: game.AdminSortField(in.SortBy), Descending: in.SortOrder != "asc"}
	if in.Status != 0 {
		status := game.Status(in.Status)
		filter.Status = &status
	}
	return filter
}

type adminGameStatusInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Status int `json:"status" enum:"1,2" doc:"1 visible, 2 hidden"`
	}
}

type adminGameScalarInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		_              struct{}                         `additionalProperties:"true"`
		BID            adminGameNullableTextInput       `json:"b_id,omitempty" doc:"Blank or null clears the Bangumi id"`
		VID            adminGameNullableTextInput       `json:"v_id,omitempty" doc:"Blank or null clears the VNDB id"`
		TitleJP        *string                          `json:"title_jp,omitempty" maxLength:"255"`
		TitleZH        *string                          `json:"title_zh,omitempty" maxLength:"255"`
		TitleEN        *string                          `json:"title_en,omitempty" maxLength:"255"`
		Aliases        []string                         `json:"aliases,omitempty"`
		IntroJP        *string                          `json:"intro_jp,omitempty" maxLength:"20000"`
		IntroZH        *string                          `json:"intro_zh,omitempty" maxLength:"20000"`
		IntroEN        *string                          `json:"intro_en,omitempty" maxLength:"20000"`
		ReleaseDate    adminGameNullableDateInput       `json:"release_date,omitempty" doc:"RFC 3339 date-time; empty or null clears it"`
		ReleaseDateTBA *bool                            `json:"release_date_tba,omitempty"`
		ExtraInfo      adminGameNullableExtraInfosInput `json:"extra_info,omitempty" doc:"null stores an empty list"`
		Staffs         adminGameNullableStaffsInput     `json:"staffs,omitempty" doc:"null stores an empty list"`
		NSFW           *bool                            `json:"nsfw,omitempty"`
		Type           adminGameNullableTextInput       `json:"type,omitempty" doc:"Blank or null clears the type"`
		Platform       []string                         `json:"platform,omitempty"`
		Status         *int                             `json:"status,omitempty" enum:"1,2"`
	}
}

func (in *adminGameScalarInput) changes() game.ScalarChanges {
	body := in.Body
	changes := game.ScalarChanges{
		BID:            patch.Clearable[string](body.BID),
		VID:            patch.Clearable[string](body.VID),
		TitleJP:        body.TitleJP,
		TitleZH:        body.TitleZH,
		TitleEN:        body.TitleEN,
		IntroJP:        body.IntroJP,
		IntroZH:        body.IntroZH,
		IntroEN:        body.IntroEN,
		ReleaseDate:    patch.Clearable[time.Time](body.ReleaseDate),
		ReleaseDateTBA: body.ReleaseDateTBA,
		NSFW:           body.NSFW,
		Type:           patch.Clearable[string](body.Type),
		ExtraInfo:      body.ExtraInfo.clearable(),
		Staffs:         body.Staffs.clearable(),
	}
	if body.Aliases != nil {
		changes.Aliases = &body.Aliases
	}
	if body.Platform != nil {
		changes.Platform = &body.Platform
	}
	if body.Status != nil {
		status := game.Status(*body.Status)
		changes.Status = &status
	}
	return changes
}

type adminGameNullableTextInput struct {
	Set   bool
	Value *string
}

type adminGameNullableDateInput struct {
	Set   bool
	Value *time.Time
}

type adminGameNullableExtraInfosInput struct {
	Set   bool
	Value []adminGameExtraInfoDTO
}

type adminGameNullableStaffsInput struct {
	Set   bool
	Value []adminGameStaffDTO
}
