package lexicalhttp

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
)

const location = "body.content"

func Parse(raw json.RawMessage, maxText int) (lexical.Document, []error) {
	document, err := lexical.Parse(raw)
	if errors.Is(err, lexical.ErrNotDocument) {
		return lexical.Document{}, []error{&huma.ErrorDetail{Location: location, Message: "expected object"}}
	}
	var contentErr *lexical.ContentError
	if errors.As(err, &contentErr) {
		return lexical.Document{}, []error{&huma.ErrorDetail{Location: location, Message: contentErr.Reason}}
	}
	if err != nil {
		return lexical.Document{}, []error{&huma.ErrorDetail{Location: location, Message: err.Error()}}
	}
	if document.TextLength() > maxText {
		return lexical.Document{}, []error{&huma.ErrorDetail{Location: location, Message: fmt.Sprintf("expected length <= %d", maxText)}}
	}
	return document, nil
}
