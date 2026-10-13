package richtexthttp

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

const (
	body     = "body"
	location = "body.content"
	missing  = "expected required property content to be present"
)

type Content json.RawMessage

func (c Content) MarshalJSON() ([]byte, error) {
	if len(c) == 0 {
		return []byte("null"), nil
	}
	return c, nil
}

func (c *Content) UnmarshalJSON(data []byte) error {
	*c = append((*c)[:0], data...)
	return nil
}

func Parse(raw Content, schema richtext.Schema, maxText int) (richtext.Document, []error) {
	document, errs := parse(raw, location, schema, maxText)
	if errs == nil && blank(document) {
		return richtext.Document{}, []error{&huma.ErrorDetail{Location: body, Message: missing}}
	}
	return document, errs
}

func ParseOptional(raw Content, field string, schema richtext.Schema, maxText int) (*richtext.Document, []error) {
	if len(raw) == 0 {
		return nil, nil
	}
	document, errs := parse(raw, body+"."+field, schema, maxText)
	if errs != nil || blank(document) {
		return nil, errs
	}
	return &document, nil
}

func parse(raw Content, at string, schema richtext.Schema, maxText int) (richtext.Document, []error) {
	document, err := richtext.Parse(raw, schema)
	if errors.Is(err, richtext.ErrNotDocument) {
		return richtext.Document{}, refuse(at, "expected object")
	}
	var contentErr *richtext.ContentError
	if errors.As(err, &contentErr) {
		return richtext.Document{}, refuse(at, contentErr.Reason)
	}
	if err != nil {
		return richtext.Document{}, refuse(at, err.Error())
	}
	if document.TextLength() > maxText {
		return richtext.Document{}, refuse(at, fmt.Sprintf("expected length <= %d", maxText))
	}
	return document, nil
}

func blank(document richtext.Document) bool {
	return strings.TrimSpace(document.Text()) == ""
}

func refuse(at, message string) []error {
	return []error{&huma.ErrorDetail{Location: at, Message: message}}
}
