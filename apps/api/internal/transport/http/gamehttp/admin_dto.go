package gamehttp

import (
	"encoding/json"
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

const adminGameDatePattern = `^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$`

type adminGamePath struct {
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
		_              struct{}                    `additionalProperties:"true"`
		BID            adminGameNullableText       `json:"b_id,omitempty" doc:"Blank or null clears the Bangumi id"`
		VID            adminGameNullableText       `json:"v_id,omitempty" doc:"Blank or null clears the VNDB id"`
		TitleJP        *string                     `json:"title_jp,omitempty" maxLength:"255"`
		TitleZH        *string                     `json:"title_zh,omitempty" maxLength:"255"`
		TitleEN        *string                     `json:"title_en,omitempty" maxLength:"255"`
		Aliases        []string                    `json:"aliases,omitempty"`
		IntroJP        *string                     `json:"intro_jp,omitempty" maxLength:"20000"`
		IntroZH        *string                     `json:"intro_zh,omitempty" maxLength:"20000"`
		IntroEN        *string                     `json:"intro_en,omitempty" maxLength:"20000"`
		ReleaseDate    adminGameNullableDate       `json:"release_date,omitempty" doc:"RFC 3339 date-time; empty or null clears it"`
		ReleaseDateTBA *bool                       `json:"release_date_tba,omitempty"`
		ExtraInfo      adminGameNullableExtraInfos `json:"extra_info,omitempty" doc:"null stores an empty list"`
		Staffs         adminGameNullableStaffs     `json:"staffs,omitempty" doc:"null stores an empty list"`
		NSFW           *bool                       `json:"nsfw,omitempty"`
		Type           adminGameNullableText       `json:"type,omitempty" doc:"Blank or null clears the type"`
		Platform       []string                    `json:"platform,omitempty"`
		Status         *int                        `json:"status,omitempty" enum:"1,2"`
	}
}

func (in *adminGameScalarInput) changes() game.ScalarChanges {
	body := in.Body
	changes := game.ScalarChanges{
		BID:            game.Clearable[string](body.BID),
		VID:            game.Clearable[string](body.VID),
		TitleJP:        body.TitleJP,
		TitleZH:        body.TitleZH,
		TitleEN:        body.TitleEN,
		IntroJP:        body.IntroJP,
		IntroZH:        body.IntroZH,
		IntroEN:        body.IntroEN,
		ReleaseDate:    game.Clearable[time.Time](body.ReleaseDate),
		ReleaseDateTBA: body.ReleaseDateTBA,
		NSFW:           body.NSFW,
		Type:           game.Clearable[string](body.Type),
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

type adminGameNullableText struct {
	Set   bool
	Value *string
}

func (f *adminGameNullableText) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableText) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Nullable: true}
}

type adminGameNullableDate struct {
	Set   bool
	Value *time.Time
}

func (f *adminGameNullableDate) UnmarshalJSON(raw []byte) error {
	f.Set = true
	var text *string
	if err := json.Unmarshal(raw, &text); err != nil || text == nil || *text == "" {
		return err
	}
	parsed, err := time.Parse(time.RFC3339Nano, *text)
	if err != nil {
		return err
	}
	parsed = parsed.UTC()
	f.Value = &parsed
	return nil
}

func (adminGameNullableDate) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Nullable: true, Pattern: adminGameDatePattern, PatternDescription: "RFC 3339 date-time or empty"}
}

type adminGameExtraInfoDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type adminGameStaffDTO struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type adminGameNullableExtraInfos struct {
	Set   bool
	Value []adminGameExtraInfoDTO
}

func (f *adminGameNullableExtraInfos) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableExtraInfos) Schema(r huma.Registry) *huma.Schema {
	return nullableArray[adminGameExtraInfoDTO](r)
}

func (f adminGameNullableExtraInfos) clearable() game.Clearable[[]game.ExtraInfo] {
	if !f.Set || f.Value == nil {
		return game.Clearable[[]game.ExtraInfo]{Set: f.Set}
	}
	entries := make([]game.ExtraInfo, len(f.Value))
	for i, entry := range f.Value {
		entries[i] = game.ExtraInfo(entry)
	}
	return game.Clearable[[]game.ExtraInfo]{Set: true, Value: &entries}
}

type adminGameNullableStaffs struct {
	Set   bool
	Value []adminGameStaffDTO
}

func (f *adminGameNullableStaffs) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableStaffs) Schema(r huma.Registry) *huma.Schema {
	return nullableArray[adminGameStaffDTO](r)
}

func (f adminGameNullableStaffs) clearable() game.Clearable[[]game.Staff] {
	if !f.Set || f.Value == nil {
		return game.Clearable[[]game.Staff]{Set: f.Set}
	}
	entries := make([]game.Staff, len(f.Value))
	for i, entry := range f.Value {
		entries[i] = game.Staff(entry)
	}
	return game.Clearable[[]game.Staff]{Set: true, Value: &entries}
}

func nullableArray[T any](r huma.Registry) *huma.Schema {
	items := r.Schema(reflect.TypeFor[T](), true, "")
	return &huma.Schema{Type: huma.TypeArray, Nullable: true, Items: items}
}

type adminGameCoverDTO struct {
	URL string `json:"url"`
}

type adminGameCreatorDTO struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type adminGameItemDTO struct {
	ID        int                 `json:"id"`
	TitleJP   string              `json:"title_jp"`
	TitleZH   string              `json:"title_zh"`
	TitleEN   string              `json:"title_en"`
	Status    int                 `json:"status"`
	Views     int                 `json:"views"`
	Downloads int                 `json:"downloads"`
	NSFW      bool                `json:"nsfw"`
	Created   time.Time           `json:"created"`
	Updated   time.Time           `json:"updated"`
	Covers    []adminGameCoverDTO `json:"covers" doc:"At most one cover, kept for compatibility"`
	Creator   adminGameCreatorDTO `json:"creator"`
	Cover     *string             `json:"cover,omitempty"`
}

func toAdminGameItem(entry game.AdminEntry) adminGameItemDTO {
	covers := []adminGameCoverDTO{}
	if entry.CoverURL != nil {
		covers = append(covers, adminGameCoverDTO{URL: *entry.CoverURL})
	}
	return adminGameItemDTO{
		ID:        entry.ID,
		TitleJP:   entry.TitleJP,
		TitleZH:   entry.TitleZH,
		TitleEN:   entry.TitleEN,
		Status:    int(entry.Status),
		Views:     entry.Views,
		Downloads: entry.Downloads,
		NSFW:      entry.NSFW,
		Created:   entry.Created,
		Updated:   entry.Updated,
		Covers:    covers,
		Creator:   adminGameCreatorDTO{ID: entry.Creator.ID, Name: entry.Creator.Name},
		Cover:     entry.CoverURL,
	}
}

type adminGameScalarDTO struct {
	BID            *string         `json:"b_id"`
	VID            *string         `json:"v_id"`
	TitleJP        string          `json:"title_jp"`
	TitleZH        string          `json:"title_zh"`
	TitleEN        string          `json:"title_en"`
	Aliases        []string        `json:"aliases"`
	IntroJP        string          `json:"intro_jp"`
	IntroZH        string          `json:"intro_zh"`
	IntroEN        string          `json:"intro_en"`
	ReleaseDate    *time.Time      `json:"release_date"`
	ReleaseDateTBA bool            `json:"release_date_tba"`
	ExtraInfo      json.RawMessage `json:"extra_info"`
	Staffs         json.RawMessage `json:"staffs"`
	NSFW           bool            `json:"nsfw"`
	Type           *string         `json:"type"`
	Platform       []string        `json:"platform"`
	Status         int             `json:"status"`
}

func toAdminGameScalar(s game.Scalar) adminGameScalarDTO {
	return adminGameScalarDTO{
		BID:            s.BID,
		VID:            s.VID,
		TitleJP:        s.TitleJP,
		TitleZH:        s.TitleZH,
		TitleEN:        s.TitleEN,
		Aliases:        nonNilStrings(s.Aliases),
		IntroJP:        s.IntroJP,
		IntroZH:        s.IntroZH,
		IntroEN:        s.IntroEN,
		ReleaseDate:    s.ReleaseDate,
		ReleaseDateTBA: s.ReleaseDateTBA,
		ExtraInfo:      s.ExtraInfo,
		Staffs:         s.Staffs,
		NSFW:           s.NSFW,
		Type:           s.Type,
		Platform:       nonNilStrings(s.Platform),
		Status:         int(s.Status),
	}
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
