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
	document, err := richtext.Parse(raw, schema)
	if errors.Is(err, richtext.ErrNotDocument) {
		return richtext.Document{}, refuse("expected object")
	}
	var contentErr *richtext.ContentError
	if errors.As(err, &contentErr) {
		return richtext.Document{}, refuse(contentErr.Reason)
	}
	if err != nil {
		return richtext.Document{}, refuse(err.Error())
	}
	if strings.TrimSpace(document.Text()) == "" {
		return richtext.Document{}, []error{&huma.ErrorDetail{Location: body, Message: missing}}
	}
	if document.TextLength() > maxText {
		return richtext.Document{}, refuse(fmt.Sprintf("expected length <= %d", maxText))
	}
	return document, nil
}

func refuse(message string) []error {
	return []error{&huma.ErrorDetail{Location: location, Message: message}}
}
