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
			"A rich text document: what the editor stores for comments and walkthroughs",
			[]string{"type", "content"},
			map[string]*huma.Schema{
				"type":    {Type: huma.TypeString, Enum: []any{"doc"}},
				"content": {Type: huma.TypeArray, Items: reference(nodeSchema), MinItems: &one},
			},
		),
		nodeSchema: object(
			"A block or inline node; which nodes a field accepts depends on the field",
			[]string{"type"},
			map[string]*huma.Schema{
				"type":    {Type: huma.TypeString, Enum: values(richtext.NodeTypes())},
				"attrs":   object("", nil, nodeAttributes()),
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

func nodeAttributes() map[string]*huma.Schema {
	alt, caption := richtext.MaxAltLength, richtext.MaxCaptionLength
	side := &huma.Schema{Type: huma.TypeInteger, Minimum: number(1), Maximum: number(richtext.MaxImageSide)}
	span := &huma.Schema{Type: huma.TypeInteger, Minimum: number(1), Maximum: number(richtext.MaxCellSpan)}
	return map[string]*huma.Schema{
		"level":   {Type: huma.TypeInteger, Enum: values(richtext.HeadingLevels), Description: "Heading level"},
		"src":     {Type: huma.TypeString, Description: "Key of an image_block, as returned by the rich text picture upload"},
		"alt":     {Type: huma.TypeString, MaxLength: &alt},
		"caption": {Type: huma.TypeString, MaxLength: &caption},
		"width":   side,
		"height":  side,
		"width_percent": {
			Type:        huma.TypeInteger,
			Minimum:     number(richtext.MinImageWidthPercent),
			Maximum:     number(richtext.MaxImageWidthPercent),
			Description: "Share of the text column an image_block is shown at; it is never shown wider than it is",
		},
		"colspan": span,
		"rowspan": span,
		"align": {
			Type:        huma.TypeString,
			Nullable:    true,
			Enum:        values(richtext.CellAlignments),
			Description: "Text alignment of a table cell; null follows the reading direction",
		},
		"colwidth": {
			Type:        huma.TypeArray,
			Nullable:    true,
			Items:       &huma.Schema{Type: huma.TypeInteger, Minimum: number(0), Maximum: number(richtext.MaxColumnWidth)},
			Description: "Column widths of a table cell in pixels, one per column it spans; null when none was set",
		},
	}
}

func number(value int) *float64 {
	converted := float64(value)
	return &converted
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
