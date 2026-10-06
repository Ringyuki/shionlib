package setting

import (
	"encoding/json"
	"strings"
	"time"
)

type Kind string

const (
	KindInt      Kind = "int"
	KindBytes    Kind = "bytes"
	KindFloat    Kind = "float"
	KindDuration Kind = "duration"
	KindFlag     Kind = "flag"
	KindText     Kind = "text"
)

type Key[T Scalar] struct {
	name     string
	fallback T
}

func (k Key[T]) Name() string {
	return k.name
}

func (k Key[T]) Default() T {
	return k.fallback
}

func (k Key[T]) Read(source Source) T {
	if value, ok := source.Lookup(k.name); ok {
		if typed, ok := value.(T); ok {
			return typed
		}
	}
	return k.fallback
}

type Spec[T Scalar] struct {
	Name        string
	Label       string
	Description string
	Default     T
	Min         T
	Max         T
	MaxLength   int
}

type Definition struct {
	Name        string
	Kind        Kind
	Label       string
	Description string
	Default     json.RawMessage
	Min         json.RawMessage
	Max         json.RawMessage
	MaxLength   int
	parse       func(raw json.RawMessage) (any, error)
}

func (d Definition) Group() string {
	group, _, _ := strings.Cut(d.Name, ".")
	return group
}

func (d Definition) Parse(raw json.RawMessage) (any, error) {
	return d.parse(raw)
}

func (d Definition) Normalize(raw json.RawMessage) (json.RawMessage, error) {
	value, err := d.parse(raw)
	if err != nil {
		return nil, err
	}
	if duration, ok := value.(time.Duration); ok {
		return encode(seconds(duration)), nil
	}
	return encode(value), nil
}

type StoredValue struct {
	Name    string
	Value   json.RawMessage
	Updated time.Time
}

type Editor struct {
	ID   int
	Name string
}

type Change struct {
	ID       int
	Name     string
	Previous json.RawMessage
	Value    json.RawMessage
	Editor   *Editor
	Created  time.Time
}

type NewChange struct {
	Name     string
	Previous json.RawMessage
	Value    json.RawMessage
	EditorID int
}

type Entry struct {
	Definition
	Value      json.RawMessage
	Overridden bool
	LastChange *Change
}

func newEntry(def Definition, row *StoredValue, last *Change) Entry {
	entry := Entry{Definition: def, Value: def.Default, LastChange: last}
	if row == nil {
		return entry
	}
	if value, err := def.Normalize(row.Value); err == nil {
		entry.Value, entry.Overridden = value, true
	}
	return entry
}
