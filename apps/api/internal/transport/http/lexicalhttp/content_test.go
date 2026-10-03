package lexicalhttp_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/lexicalhttp"
)

func paragraph(text string) json.RawMessage {
	raw, _ := json.Marshal(map[string]any{"root": map[string]any{"type": "root", "children": []any{
		map[string]any{"type": "paragraph", "children": []any{map[string]any{"type": "text", "text": text}}},
	}}})
	return raw
}

func detail(t *testing.T, errs []error) *huma.ErrorDetail {
	t.Helper()
	if len(errs) != 1 {
		t.Fatalf("errors %v", errs)
	}
	var found *huma.ErrorDetail
	if !errors.As(errs[0], &found) || found.Location != "body.content" {
		t.Fatalf("error %#v", errs[0])
	}
	return found
}

func TestValidDocumentsParse(t *testing.T) {
	document, errs := lexicalhttp.Parse(paragraph("hello"), 10)
	if errs != nil || document.TextLength() != 5 {
		t.Fatalf("document %+v errors %v", document, errs)
	}
}

func TestInvalidDocumentsAreReportedOnTheContentField(t *testing.T) {
	if got := detail(t, second(lexicalhttp.Parse(json.RawMessage(`"text"`), 10))); got.Message != "expected object" {
		t.Fatalf("not a document: %q", got.Message)
	}
	if got := detail(t, second(lexicalhttp.Parse(json.RawMessage(`{"root":{"type":"paragraph","children":[]}}`), 10))); got.Message == "" {
		t.Fatal("wrong root type needs a reason")
	}
	if got := detail(t, second(lexicalhttp.Parse(paragraph(strings.Repeat("a", 11)), 10))); got.Message != "expected length <= 10" {
		t.Fatalf("too long: %q", got.Message)
	}
}

func second[A, B any](_ A, b B) B {
	return b
}
