package apperror

import (
	"fmt"
	"slices"
	"sync"
)

const messageKeyPrefix = "shion-biz."

type Definition struct {
	code int
	name string
	kind Kind
}

var registry = struct {
	mu     sync.Mutex
	byCode map[int]Definition
	byName map[string]Definition
}{
	byCode: map[int]Definition{},
	byName: map[string]Definition{},
}

func Define(code int, name string, kind Kind) Definition {
	if code <= 0 {
		panic(fmt.Sprintf("apperror: code for %s must be positive", name))
	}
	if name == "" {
		panic(fmt.Sprintf("apperror: code %d has an empty name", code))
	}
	def := Definition{code: code, name: name, kind: kind}
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if existing, ok := registry.byCode[code]; ok {
		panic(fmt.Sprintf("apperror: code %d is defined twice (%s, %s)", code, existing.name, name))
	}
	if existing, ok := registry.byName[name]; ok {
		panic(fmt.Sprintf("apperror: name %s is defined twice (%d, %d)", name, existing.code, code))
	}
	registry.byCode[code] = def
	registry.byName[name] = def
	return def
}

func Registered() []Definition {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	defs := make([]Definition, 0, len(registry.byCode))
	for _, def := range registry.byCode {
		defs = append(defs, def)
	}
	slices.SortFunc(defs, func(a, b Definition) int { return a.code - b.code })
	return defs
}

func (d Definition) Code() int {
	return d.code
}

func (d Definition) Name() string {
	return d.name
}

func (d Definition) Kind() Kind {
	return d.kind
}

func (d Definition) MessageKey() string {
	return messageKeyPrefix + d.name
}

func (d Definition) Error() string {
	return d.name
}

func (d Definition) New() *Error {
	return &Error{def: d}
}

func (d Definition) Wrap(cause error) *Error {
	return &Error{def: d, cause: cause}
}

func (d Definition) WithArgs(args map[string]any) *Error {
	return d.New().WithArgs(args)
}

func (d Definition) WithField(field string, messages ...string) *Error {
	return d.New().WithField(field, messages...)
}
