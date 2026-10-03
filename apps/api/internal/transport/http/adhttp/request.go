package adhttp

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adPathInput struct {
	ID int `path:"id" minimum:"1"`
}

func (f *adNullableTextInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adNullableTextInput) Schema(huma.Registry) *huma.Schema {
	maxLength := ad.MaxImageLength
	return &huma.Schema{Type: huma.TypeString, Nullable: true, MaxLength: &maxLength}
}

func (f *adNullableTimeInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adNullableTimeInput) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Format: "date-time", Nullable: true}
}

type adPlacementInput struct {
	Placement string `path:"placement" minLength:"1" maxLength:"100"`
}

type listAdsInput struct {
	httpapi.PageQuery
	Placement string `query:"placement" maxLength:"100"`
	Enabled   string `query:"enabled" enum:"true,false"`
	SortBy    string `query:"sortBy" enum:"id,sort,created,updated" default:"id"`
	SortOrder string `query:"sortOrder" enum:"asc,desc" default:"desc"`
}

func (in *listAdsInput) filter() ad.ListFilter {
	filter := ad.ListFilter{SortBy: ad.SortField(in.SortBy), Descending: in.SortOrder != "asc"}
	if in.Placement != "" {
		filter.Placement = &in.Placement
	}
	if in.Enabled != "" {
		enabled := in.Enabled == "true"
		filter.Enabled = &enabled
	}
	return filter
}

type createAdInput struct {
	Body struct {
		Name           string     `json:"name" maxLength:"100"`
		Placement      []string   `json:"placement"`
		ImageZH        string     `json:"image_zh" maxLength:"500"`
		ImageJA        *string    `json:"image_ja,omitempty" maxLength:"500"`
		ImageEN        *string    `json:"image_en,omitempty" maxLength:"500"`
		Aspect         string     `json:"aspect" maxLength:"20"`
		Link           string     `json:"link" maxLength:"500"`
		ExcludeLocales []string   `json:"exclude_locales,omitempty"`
		Enabled        *bool      `json:"enabled,omitempty"`
		Sort           *int       `json:"sort,omitempty" minimum:"-2147483648" maximum:"2147483647"`
		StartAt        *time.Time `json:"start_at,omitempty"`
		EndAt          *time.Time `json:"end_at,omitempty"`
	}
}

type updateAdInput struct {
	ID   int `path:"id" minimum:"1"`
	Body struct {
		Name           *string             `json:"name,omitempty" maxLength:"100"`
		Placement      []string            `json:"placement,omitempty"`
		ImageZH        *string             `json:"image_zh,omitempty" maxLength:"500"`
		ImageJA        adNullableTextInput `json:"image_ja,omitempty" doc:"null clears the image"`
		ImageEN        adNullableTextInput `json:"image_en,omitempty" doc:"null clears the image"`
		Aspect         *string             `json:"aspect,omitempty" maxLength:"20"`
		Link           *string             `json:"link,omitempty" maxLength:"500"`
		ExcludeLocales []string            `json:"exclude_locales,omitempty"`
		Enabled        *bool               `json:"enabled,omitempty"`
		Sort           *int                `json:"sort,omitempty" minimum:"-2147483648" maximum:"2147483647"`
		StartAt        adNullableTimeInput `json:"start_at,omitempty" doc:"null clears the start"`
		EndAt          adNullableTimeInput `json:"end_at,omitempty" doc:"null clears the end"`
	}
}

func (in *updateAdInput) changes() ad.Changes {
	body := in.Body
	changes := ad.Changes{
		Name:    body.Name,
		ImageZH: body.ImageZH,
		ImageJA: patch.Clearable[string](body.ImageJA),
		ImageEN: patch.Clearable[string](body.ImageEN),
		Aspect:  body.Aspect,
		Link:    body.Link,
		Enabled: body.Enabled,
		Sort:    body.Sort,
		StartAt: patch.Clearable[time.Time](body.StartAt),
		EndAt:   patch.Clearable[time.Time](body.EndAt),
	}
	if body.Placement != nil {
		changes.Placement = &body.Placement
	}
	if body.ExcludeLocales != nil {
		changes.ExcludeLocales = &body.ExcludeLocales
	}
	return changes
}

type adNullableTextInput struct {
	Set   bool
	Value *string
}

type adNullableTimeInput struct {
	Set   bool
	Value *time.Time
}
