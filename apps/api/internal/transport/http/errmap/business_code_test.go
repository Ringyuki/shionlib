package errmap_test

import (
	"slices"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
)

func TestBusinessCodeSchemaNamesEveryRegisteredCode(t *testing.T) {
	schema := errmap.BusinessCodeSchema()
	names, ok := schema.Extensions["x-enum-varnames"].([]string)
	if !ok || len(names) != len(schema.Enum) {
		t.Fatalf("enum %v names %v", schema.Enum, schema.Extensions)
	}
	index := slices.Index(names, "TEST_MISSING")
	if index < 0 || schema.Enum[index] != errMissing.Code() {
		t.Fatalf("TEST_MISSING not published: %v %v", schema.Enum, names)
	}
	if !slices.IsSortedFunc(schema.Enum, func(a, b any) int { return a.(int) - b.(int) }) {
		t.Fatalf("codes are not sorted: %v", schema.Enum)
	}
}

func TestErrorCodesReferenceTheBusinessCodeSchema(t *testing.T) {
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)
	schema := errmap.Code(0).Schema(registry)
	if len(schema.AnyOf) != 2 || schema.AnyOf[0].Ref != "#/components/schemas/BusinessCode" {
		t.Fatalf("code schema %+v", schema)
	}
	if registry.Map()["BusinessCode"] == nil {
		t.Fatal("BusinessCode was not registered")
	}
}
