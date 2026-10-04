package errmap

import (
	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

const businessCodeSchemaName = "BusinessCode"

type Code int

func (Code) Schema(r huma.Registry) *huma.Schema {
	if _, ok := r.Map()[businessCodeSchemaName]; !ok {
		r.Map()[businessCodeSchemaName] = BusinessCodeSchema()
	}
	return &huma.Schema{
		Description: "A business code, or the HTTP status when the failure has no business code.",
		AnyOf: []*huma.Schema{
			{Ref: "#/components/schemas/" + businessCodeSchemaName},
			{Type: huma.TypeInteger, Format: "int64"},
		},
	}
}

func BusinessCodeSchema() *huma.Schema {
	defs := apperror.Registered()
	codes := make([]any, len(defs))
	names := make([]string, len(defs))
	for i, def := range defs {
		codes[i] = def.Code()
		names[i] = def.Name()
	}
	return &huma.Schema{
		Type:       huma.TypeInteger,
		Format:     "int64",
		Enum:       codes,
		Extensions: map[string]any{"x-enum-varnames": names},
	}
}
