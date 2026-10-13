package aihttp

import (
	"encoding/json"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

type aiIDPathInput struct {
	ID int `path:"id" minimum:"1"`
}

type aiRangeInput struct {
	Range string `query:"range" enum:"1h,24h,7d,30d" default:"24h"`
}

func rangeOf(raw string) ai.Range {
	if raw == "" {
		return ai.RangeDay
	}
	return ai.Range(raw)
}

type aiNullableTextInput struct {
	Set   bool
	Value *string
}

func (f *aiNullableTextInput) UnmarshalJSON(raw []byte) error {
	f.Set = true
	return json.Unmarshal(raw, &f.Value)
}

func (aiNullableTextInput) Schema(huma.Registry) *huma.Schema {
	maxLength := 500
	return &huma.Schema{Type: huma.TypeString, Nullable: true, MaxLength: &maxLength}
}

func (f aiNullableTextInput) change() **string {
	if !f.Set {
		return nil
	}
	value := f.Value
	return &value
}

func optionalProtocol(raw *string) *ai.Protocol {
	if raw == nil {
		return nil
	}
	protocol := ai.Protocol(*raw)
	return &protocol
}

func positive(value int) *int {
	if value <= 0 {
		return nil
	}
	return &value
}
