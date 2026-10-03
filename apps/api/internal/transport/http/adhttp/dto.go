package adhttp

import (
	"encoding/json"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

type adPlacementInput struct {
	Placement string `path:"placement" minLength:"1" maxLength:"100"`
}

type adPath struct {
	ID int `path:"id" minimum:"1"`
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
		Name           *string        `json:"name,omitempty" maxLength:"100"`
		Placement      []string       `json:"placement,omitempty"`
		ImageZH        *string        `json:"image_zh,omitempty" maxLength:"500"`
		ImageJA        adNullableText `json:"image_ja,omitempty" doc:"null clears the image"`
		ImageEN        adNullableText `json:"image_en,omitempty" doc:"null clears the image"`
		Aspect         *string        `json:"aspect,omitempty" maxLength:"20"`
		Link           *string        `json:"link,omitempty" maxLength:"500"`
		ExcludeLocales []string       `json:"exclude_locales,omitempty"`
		Enabled        *bool          `json:"enabled,omitempty"`
		Sort           *int           `json:"sort,omitempty" minimum:"-2147483648" maximum:"2147483647"`
		StartAt        adNullableTime `json:"start_at,omitempty" doc:"null clears the start"`
		EndAt          adNullableTime `json:"end_at,omitempty" doc:"null clears the end"`
	}
}

func (in *updateAdInput) changes() ad.Changes {
	body := in.Body
	changes := ad.Changes{
		Name:    body.Name,
		ImageZH: body.ImageZH,
		ImageJA: ad.Clearable[string](body.ImageJA),
		ImageEN: ad.Clearable[string](body.ImageEN),
		Aspect:  body.Aspect,
		Link:    body.Link,
		Enabled: body.Enabled,
		Sort:    body.Sort,
		StartAt: ad.Clearable[time.Time](body.StartAt),
		EndAt:   ad.Clearable[time.Time](body.EndAt),
	}
	if body.Placement != nil {
		changes.Placement = &body.Placement
	}
	if body.ExcludeLocales != nil {
		changes.ExcludeLocales = &body.ExcludeLocales
	}
	return changes
}

type adNullableText struct {
	Set   bool
	Value *string
}

func (f *adNullableText) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adNullableText) Schema(huma.Registry) *huma.Schema {
	maxLength := ad.MaxImageLength
	return &huma.Schema{Type: huma.TypeString, Nullable: true, MaxLength: &maxLength}
}

type adNullableTime struct {
	Set   bool
	Value *time.Time
}

func (f *adNullableTime) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adNullableTime) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Format: "date-time", Nullable: true}
}

type adItemDTO struct {
	ID             int      `json:"id"`
	ImageZH        string   `json:"image_zh"`
	ImageJA        *string  `json:"image_ja"`
	ImageEN        *string  `json:"image_en"`
	Aspect         string   `json:"aspect"`
	Link           string   `json:"link"`
	ExcludeLocales []string `json:"exclude_locales"`
}

type adAdminDTO struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	Placement      []string   `json:"placement"`
	ImageZH        string     `json:"image_zh"`
	ImageJA        *string    `json:"image_ja"`
	ImageEN        *string    `json:"image_en"`
	Aspect         string     `json:"aspect"`
	Link           string     `json:"link"`
	ExcludeLocales []string   `json:"exclude_locales"`
	Enabled        bool       `json:"enabled"`
	Sort           int        `json:"sort"`
	StartAt        *time.Time `json:"start_at"`
	EndAt          *time.Time `json:"end_at"`
	Created        time.Time  `json:"created"`
	Updated        time.Time  `json:"updated"`
}

func toItemDTO(item ad.Ad) adItemDTO {
	return adItemDTO{
		ID:             item.ID,
		ImageZH:        item.ImageZH,
		ImageJA:        item.ImageJA,
		ImageEN:        item.ImageEN,
		Aspect:         item.Aspect,
		Link:           item.Link,
		ExcludeLocales: nonNil(item.ExcludeLocales),
	}
}

func toAdminDTO(item ad.Ad) adAdminDTO {
	return adAdminDTO{
		ID:             item.ID,
		Name:           item.Name,
		Placement:      nonNil(item.Placement),
		ImageZH:        item.ImageZH,
		ImageJA:        item.ImageJA,
		ImageEN:        item.ImageEN,
		Aspect:         item.Aspect,
		Link:           item.Link,
		ExcludeLocales: nonNil(item.ExcludeLocales),
		Enabled:        item.Enabled,
		Sort:           item.Sort,
		StartAt:        item.StartAt,
		EndAt:          item.EndAt,
		Created:        item.Created,
		Updated:        item.Updated,
	}
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
