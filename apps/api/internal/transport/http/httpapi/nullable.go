package httpapi

import (
	"reflect"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
)

const (
	jsonTag  = "json"
	nullType = "null"
)

var timeType = reflect.TypeFor[time.Time]()

func markNullableObjects(registry huma.Registry, root reflect.Type) {
	visit(registry, root, map[reflect.Type]bool{})
}

func visit(registry huma.Registry, t reflect.Type, seen map[reflect.Type]bool) {
	for t.Kind() == reflect.Pointer || t.Kind() == reflect.Slice || t.Kind() == reflect.Array || t.Kind() == reflect.Map {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct || t == timeType || seen[t] {
		return
	}
	seen[t] = true
	schema := registered(registry, t)
	for i := range t.NumField() {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}
		if name, ok := propertyName(field); ok && schema != nil && nullableObject(field.Type) {
			if property := schema.Properties[name]; property != nil && property.Ref != "" {
				schema.Properties[name] = &huma.Schema{
					Description: property.Description,
					OneOf:       []*huma.Schema{{Ref: property.Ref}, {Type: nullType}},
				}
			}
		}
		visit(registry, field.Type, seen)
	}
}

func registered(registry huma.Registry, t reflect.Type) *huma.Schema {
	if t.Name() == "" {
		return nil
	}
	return registry.Map()[huma.DefaultSchemaNamer(t, "")]
}

func propertyName(field reflect.StructField) (string, bool) {
	name, options, _ := strings.Cut(field.Tag.Get(jsonTag), ",")
	if name == "" || name == "-" || strings.Contains(options, "omitempty") {
		return "", false
	}
	return name, true
}

func nullableObject(t reflect.Type) bool {
	return t.Kind() == reflect.Pointer && t.Elem().Kind() == reflect.Struct && t.Elem() != timeType
}
