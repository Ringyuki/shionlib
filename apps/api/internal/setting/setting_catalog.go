package setting

import (
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

var namePattern = regexp.MustCompile(`^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`)

var catalog = struct {
	mu     sync.Mutex
	byName map[string]Definition
}{byName: map[string]Definition{}}

func Int(spec Spec[int]) Key[int] {
	requireRange(spec)
	return register(spec, Definition{
		Kind: KindInt,
		Min:  encode(spec.Min),
		Max:  encode(spec.Max),
		parse: func(raw json.RawMessage) (any, error) {
			value, err := parseWhole(raw, int64(spec.Min), int64(spec.Max))
			return int(value), err
		},
	})
}

func Bytes(spec Spec[int64]) Key[int64] {
	requireRange(spec)
	return register(spec, Definition{
		Kind: KindBytes,
		Min:  encode(spec.Min),
		Max:  encode(spec.Max),
		parse: func(raw json.RawMessage) (any, error) {
			return parseWhole(raw, spec.Min, spec.Max)
		},
	})
}

func Float(spec Spec[float64]) Key[float64] {
	requireRange(spec)
	return register(spec, Definition{
		Kind: KindFloat,
		Min:  encode(spec.Min),
		Max:  encode(spec.Max),
		parse: func(raw json.RawMessage) (any, error) {
			return parseFloat(raw, spec.Min, spec.Max)
		},
	})
}

func Duration(spec Spec[time.Duration]) Key[time.Duration] {
	requireRange(spec)
	for _, bound := range []time.Duration{spec.Default, spec.Min, spec.Max} {
		if bound%time.Second != 0 {
			panic(fmt.Sprintf("setting: %s must use whole seconds", spec.Name))
		}
	}
	return register(spec, Definition{
		Kind: KindDuration,
		Min:  encode(seconds(spec.Min)),
		Max:  encode(seconds(spec.Max)),
		parse: func(raw json.RawMessage) (any, error) {
			value, err := parseWhole(raw, seconds(spec.Min), seconds(spec.Max))
			return time.Duration(value) * time.Second, err
		},
	})
}

func Flag(spec Spec[bool]) Key[bool] {
	return register(spec, Definition{Kind: KindFlag, parse: parseFlag})
}

func Text(spec Spec[string]) Key[string] {
	if spec.MaxLength <= 0 || len([]rune(spec.Default)) > spec.MaxLength {
		panic(fmt.Sprintf("setting: %s needs a max length that fits its default", spec.Name))
	}
	return register(spec, Definition{
		Kind:      KindText,
		MaxLength: spec.MaxLength,
		parse: func(raw json.RawMessage) (any, error) {
			return parseText(raw, spec.MaxLength)
		},
	})
}

func Secret(spec Spec[string]) Key[string] {
	if spec.MaxLength <= 0 || spec.Default != "" {
		panic(fmt.Sprintf("setting: %s needs a max length and no default", spec.Name))
	}
	return register(spec, Definition{
		Kind:      KindSecret,
		MaxLength: spec.MaxLength,
		parse: func(raw json.RawMessage) (any, error) {
			return parseText(raw, spec.MaxLength)
		},
	})
}

func Definitions() []Definition {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	defs := make([]Definition, 0, len(catalog.byName))
	for _, def := range catalog.byName {
		defs = append(defs, def)
	}
	slices.SortFunc(defs, func(a, b Definition) int { return strings.Compare(a.Name, b.Name) })
	return defs
}

func Find(name string) (Definition, bool) {
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	def, ok := catalog.byName[name]
	return def, ok
}

func register[T Scalar](spec Spec[T], def Definition) Key[T] {
	if !namePattern.MatchString(spec.Name) {
		panic(fmt.Sprintf("setting: name %q must look like group.name in snake case", spec.Name))
	}
	if spec.Label == "" {
		panic(fmt.Sprintf("setting: %s needs a label", spec.Name))
	}
	def.Name, def.Label, def.Description = spec.Name, spec.Label, spec.Description
	def.Default = encode(any(spec.Default))
	if def.Kind == KindDuration {
		def.Default = encode(seconds(any(spec.Default).(time.Duration)))
	}
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	if _, ok := catalog.byName[spec.Name]; ok {
		panic(fmt.Sprintf("setting: %s is declared twice", spec.Name))
	}
	catalog.byName[spec.Name] = def
	return Key[T]{name: spec.Name, fallback: spec.Default}
}

func requireRange[T int | int64 | float64 | time.Duration](spec Spec[T]) {
	if spec.Min > spec.Default || spec.Default > spec.Max {
		panic(fmt.Sprintf("setting: %s needs min <= default <= max", spec.Name))
	}
}
