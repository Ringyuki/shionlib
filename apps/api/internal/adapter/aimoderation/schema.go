package aimoderation

import "github.com/Ringyuki/shionlib/apps/api/internal/moderation"

type stringEnum struct {
	Type string   `json:"type"`
	Enum []string `json:"enum"`
}

type boundedString struct {
	Type      string `json:"type"`
	MaxLength int    `json:"maxLength"`
}

type booleanType struct {
	Type string `json:"type"`
}

type booleanMap struct {
	Type                 string      `json:"type"`
	Properties           struct{}    `json:"properties"`
	AdditionalProperties booleanType `json:"additionalProperties"`
	Required             []string    `json:"required"`
}

type verdictProperties struct {
	Decision    stringEnum    `json:"decision"`
	Reason      boundedString `json:"reason"`
	Evidence    boundedString `json:"evidence"`
	TopCategory stringEnum    `json:"top_category"`
	Categories  booleanMap    `json:"categories_json"`
}

type verdictSchema struct {
	Schema               string            `json:"$schema"`
	Type                 string            `json:"type"`
	Properties           verdictProperties `json:"properties"`
	Required             []string          `json:"required"`
	AdditionalProperties bool              `json:"additionalProperties"`
}

func newVerdictSchema() verdictSchema {
	categories := moderation.Categories()
	names := make([]string, len(categories))
	for i, category := range categories {
		names[i] = string(category)
	}
	return verdictSchema{
		Schema: "http://json-schema.org/draft-07/schema#",
		Type:   "object",
		Properties: verdictProperties{
			Decision:    stringEnum{Type: "string", Enum: []string{string(moderation.DecisionAllow), string(moderation.DecisionBlock)}},
			Reason:      boundedString{Type: "string", MaxLength: maxReasonLength},
			Evidence:    boundedString{Type: "string", MaxLength: maxEvidenceLength},
			TopCategory: stringEnum{Type: "string", Enum: names},
			Categories:  booleanMap{Type: "object", AdditionalProperties: booleanType{Type: "boolean"}, Required: []string{}},
		},
		Required:             []string{"decision", "reason", "evidence", "top_category", "categories_json"},
		AdditionalProperties: false,
	}
}
