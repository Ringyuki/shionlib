package apperror

import (
	"errors"
	"maps"
	"slices"
)

type FieldError struct {
	Field    string
	Messages []string
}

type Error struct {
	def        Definition
	messageKey string
	args       map[string]any
	fields     []FieldError
	cause      error
}

func (e *Error) Error() string {
	if e.cause == nil {
		return e.def.name
	}
	return e.def.name + ": " + e.cause.Error()
}

func (e *Error) Unwrap() error {
	return e.cause
}

func (e *Error) Is(target error) bool {
	switch t := target.(type) {
	case Definition:
		return t.code == e.def.code
	case *Error:
		return t.def.code == e.def.code
	default:
		return false
	}
}

func (e *Error) Definition() Definition {
	return e.def
}

func (e *Error) MessageKey() string {
	if e.messageKey != "" {
		return e.messageKey
	}
	return e.def.MessageKey()
}

func (e *Error) Args() map[string]any {
	return maps.Clone(e.args)
}

func (e *Error) Fields() []FieldError {
	return slices.Clone(e.fields)
}

func (e *Error) WithArgs(args map[string]any) *Error {
	clone := e.clone()
	if clone.args == nil {
		clone.args = make(map[string]any, len(args))
	}
	maps.Copy(clone.args, args)
	return clone
}

func (e *Error) WithField(field string, messages ...string) *Error {
	clone := e.clone()
	clone.fields = append(clone.fields, FieldError{Field: field, Messages: slices.Clone(messages)})
	return clone
}

func (e *Error) WithMessageKey(key string) *Error {
	clone := e.clone()
	clone.messageKey = key
	return clone
}

func (e *Error) WithCause(cause error) *Error {
	clone := e.clone()
	clone.cause = cause
	return clone
}

func (e *Error) clone() *Error {
	return &Error{
		def:        e.def,
		messageKey: e.messageKey,
		args:       maps.Clone(e.args),
		fields:     slices.Clone(e.fields),
		cause:      e.cause,
	}
}

func From(err error) (*Error, bool) {
	if err == nil {
		return nil, false
	}
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr, true
	}
	var def Definition
	if errors.As(err, &def) {
		return def.New(), true
	}
	return nil, false
}
