package gamehttp

import (
	"encoding/json"
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

const adminGameDatePattern = `^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$`

func (f *adminGameNullableTextInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableTextInput) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Nullable: true}
}

func (f *adminGameNullableDateInput) UnmarshalJSON(raw []byte) error {
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

func (adminGameNullableDateInput) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{Type: huma.TypeString, Nullable: true, Pattern: adminGameDatePattern, PatternDescription: "RFC 3339 date-time or empty"}
}

func (f *adminGameNullableExtraInfosInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableExtraInfosInput) Schema(r huma.Registry) *huma.Schema {
	return nullableArray[adminGameExtraInfoDTO](r)
}

func (f adminGameNullableExtraInfosInput) clearable() patch.Clearable[[]game.ExtraInfo] {
	if !f.Set || f.Value == nil {
		return patch.Clearable[[]game.ExtraInfo]{Set: f.Set}
	}
	entries := make([]game.ExtraInfo, len(f.Value))
	for i, entry := range f.Value {
		entries[i] = game.ExtraInfo(entry)
	}
	return patch.Clearable[[]game.ExtraInfo]{Set: true, Value: &entries}
}

func (f *adminGameNullableStaffsInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (adminGameNullableStaffsInput) Schema(r huma.Registry) *huma.Schema {
	return nullableArray[adminGameStaffDTO](r)
}

func (f adminGameNullableStaffsInput) clearable() patch.Clearable[[]game.Staff] {
	if !f.Set || f.Value == nil {
		return patch.Clearable[[]game.Staff]{Set: f.Set}
	}
	entries := make([]game.Staff, len(f.Value))
	for i, entry := range f.Value {
		entries[i] = game.Staff(entry)
	}
	return patch.Clearable[[]game.Staff]{Set: true, Value: &entries}
}

func nullableArray[T any](r huma.Registry) *huma.Schema {
	items := r.Schema(reflect.TypeFor[T](), true, "")
	return &huma.Schema{Type: huma.TypeArray, Nullable: true, Items: items}
}

type gamePathInput struct {
	ID int `path:"id"`
}

type gameRecentUpdateInput struct {
	httpapi.PageQuery
}

type bangumiResourceInput struct {
	Path string `query:"path" default:"subjects" enum:"subjects,characters,persons,episodes,indices" doc:"Bangumi v0 resource kind"`
	ID   string `query:"id" required:"true" pattern:"^[0-9]{1,20}$" doc:"Bangumi resource id"`
	Type string `query:"type" enum:"subjects,characters,persons" doc:"Optional related collection of the resource"`
}
