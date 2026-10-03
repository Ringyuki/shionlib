package httpapi

import (
	"fmt"
	"reflect"
	"regexp"
	"slices"
)

var placeholder = regexp.MustCompile(`\{([^}/]+)\}`)

func checkPathParams(path string, input reflect.Type) {
	var expected []string
	for _, match := range placeholder.FindAllStringSubmatch(path, -1) {
		expected = append(expected, match[1])
	}
	declared := declaredPathParams(input)
	slices.Sort(expected)
	slices.Sort(declared)
	if !slices.Equal(expected, declared) {
		panic(fmt.Sprintf("httpapi: route %s declares path params %v but input %s binds %v; declare every path param as an exported field", path, expected, input, declared))
	}
}

func declaredPathParams(t reflect.Type) []string {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil
	}
	var params []string
	for i := range t.NumField() {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}
		if field.Anonymous {
			params = append(params, declaredPathParams(field.Type)...)
			continue
		}
		if name, ok := field.Tag.Lookup("path"); ok {
			params = append(params, name)
		}
	}
	return params
}
