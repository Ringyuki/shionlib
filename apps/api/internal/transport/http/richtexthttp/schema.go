package richtexthttp

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

const (
	schemaPrefix   = "#/components/schemas/"
	documentSchema = "RichTextDocument"
	nodeSchema     = "RichTextNode"
	markSchema     = "RichTextMark"
)

func (Content) Schema(registry huma.Registry) *huma.Schema {
	schemas := registry.Map()
	if _, registered := schemas[documentSchema]; !registered {
		for name, schema := range contentSchemas() {
			schema.PrecomputeMessages()
			schemas[name] = schema
		}
	}
	return reference(documentSchema)
}

func contentSchemas() map[string]*huma.Schema {
	one, linkLength := 1, richtext.MaxLinkLength
	return map[string]*huma.Schema{
		documentSchema: object(
			"A rich text document: what the editor stores for a comment and for the note of a walkthrough",
			[]string{"type", "content"},
			map[string]*huma.Schema{
				"type":    {Type: huma.TypeString, Enum: []any{"doc"}},
				"content": {Type: huma.TypeArray, Items: reference(nodeSchema), MinItems: &one},
			},
		),
		nodeSchema: object(
			"A paragraph, or what stands in one: text or a line break",
			[]string{"type"},
			map[string]*huma.Schema{
				"type":    {Type: huma.TypeString, Enum: values(richtext.NodeTypes())},
				"content": {Type: huma.TypeArray, Items: reference(nodeSchema)},
				"marks":   {Type: huma.TypeArray, Items: reference(markSchema)},
				"text":    {Type: huma.TypeString, MinLength: &one, Description: "Text of a text node"},
			},
		),
		markSchema: object(
			"Formatting of an inline node",
			[]string{"type"},
			map[string]*huma.Schema{
				"type": {Type: huma.TypeString, Enum: values(richtext.MarkTypes())},
				"attrs": object("", nil, map[string]*huma.Schema{
					"href": {Type: huma.TypeString, MaxLength: &linkLength, Description: "Address of a link: http, https or mailto"},
				}),
			},
		),
	}
}

func object(description string, required []string, properties map[string]*huma.Schema) *huma.Schema {
	return &huma.Schema{
		Type:                 huma.TypeObject,
		Description:          description,
		Required:             required,
		Properties:           properties,
		AdditionalProperties: false,
	}
}

func reference(name string) *huma.Schema {
	return &huma.Schema{Ref: schemaPrefix + name}
}

func values[T any](items []T) []any {
	out := make([]any, len(items))
	for i, item := range items {
		out[i] = item
	}
	return out
}
