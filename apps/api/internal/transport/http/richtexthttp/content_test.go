package richtexthttp_test

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/richtexthttp"
)

func paragraph(text string) richtexthttp.Content {
	raw, _ := json.Marshal(map[string]any{"type": "doc", "content": []any{
		map[string]any{"type": "paragraph", "content": []any{map[string]any{"type": "text", "text": text}}},
	}})
	return raw
}

func detail(t *testing.T, errs []error) *huma.ErrorDetail {
	t.Helper()
	if len(errs) != 1 {
		t.Fatalf("errors %v", errs)
	}
	var found *huma.ErrorDetail
	if !errors.As(errs[0], &found) {
		t.Fatalf("error %#v", errs[0])
	}
	return found
}

func second[A, B any](_ A, b B) B {
	return b
}

func TestValidDocumentsParse(t *testing.T) {
	document, errs := richtexthttp.Parse(paragraph("hello"), richtext.Comment, 5)
	if errs != nil || document.TextLength() != 5 || document.Text() != "hello" {
		t.Fatalf("document %+v errors %v", document, errs)
	}
}

func TestInvalidDocumentsAreReportedOnTheContentField(t *testing.T) {
	cases := []struct {
		name string
		raw  richtexthttp.Content
		want string
	}{
		{"not a document", richtexthttp.Content(`"text"`), "expected object"},
		{"missing", nil, "expected object"},
		{"outside the schema", richtexthttp.Content(`{"type":"doc","content":[{"type":"bullet_list","content":[{"type":"list_item","content":[{"type":"paragraph"}]}]}]}`), `content contains an unsupported node type "bullet_list"`},
		{"too long", paragraph(strings.Repeat("a", 11)), "expected length <= 10"},
	}
	for _, c := range cases {
		got := detail(t, second(richtexthttp.Parse(c.raw, richtext.Comment, 10)))
		if got.Location != "body.content" || got.Message != c.want {
			t.Errorf("%s: %q at %q, want %q", c.name, got.Message, got.Location, c.want)
		}
	}
}

func TestADocumentWithoutTextCountsAsMissing(t *testing.T) {
	for name, raw := range map[string]richtexthttp.Content{
		"nothing written": richtexthttp.Content(`{"type":"doc","content":[{"type":"paragraph"}]}`),
		"only spaces":     paragraph(" \u3000 "),
	} {
		got := detail(t, second(richtexthttp.Parse(raw, richtext.Comment, 10)))
		if got.Location != "body" || got.Message != "expected required property content to be present" {
			t.Errorf("%s: %q at %q", name, got.Message, got.Location)
		}
	}
}

func TestAnOptionalDocumentMayBeLeftOut(t *testing.T) {
	for name, raw := range map[string]richtexthttp.Content{
		"left out":        nil,
		"nothing written": richtexthttp.Content(`{"type":"doc","content":[{"type":"paragraph"}]}`),
	} {
		if document, errs := richtexthttp.ParseOptional(raw, "note", richtext.Comment, 10); document != nil || errs != nil {
			t.Errorf("%s: document %+v errors %v", name, document, errs)
		}
	}
	document, errs := richtexthttp.ParseOptional(paragraph("hello"), "note", richtext.Comment, 10)
	if errs != nil || document == nil || document.Text() != "hello" {
		t.Fatalf("document %+v errors %v", document, errs)
	}
	got := detail(t, second(richtexthttp.ParseOptional(paragraph(strings.Repeat("a", 11)), "note", richtext.Comment, 10)))
	if got.Location != "body.note" || got.Message != "expected length <= 10" {
		t.Fatalf("%q at %q", got.Message, got.Location)
	}
}

func TestContentTravelsAsTheStoredJSON(t *testing.T) {
	type envelope struct {
		Content richtexthttp.Content `json:"content"`
		Omitted richtexthttp.Content `json:"omitted,omitempty"`
	}
	stored := `{"type":"doc","content":[{"type":"paragraph"}]}`
	raw, err := jsoncodec.Marshal(envelope{Content: richtexthttp.Content(stored)})
	if err != nil || string(raw) != `{"content":`+stored+`}` {
		t.Fatalf("encoded %s, error %v", raw, err)
	}
	raw, err = jsoncodec.Marshal(envelope{})
	if err != nil || string(raw) != `{"content":null}` {
		t.Fatalf("encoded %s, error %v", raw, err)
	}
	var decoded envelope
	if err := json.Unmarshal([]byte(`{"content": {"type":"doc"} }`), &decoded); err != nil || string(decoded.Content) != `{"type":"doc"}` {
		t.Fatalf("decoded %s, error %v", decoded.Content, err)
	}
}

func TestTheContractDescribesTheDocument(t *testing.T) {
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)
	field := registry.Schema(reflect.TypeFor[richtexthttp.Content](), true, "")
	if field.Ref != "#/components/schemas/RichTextDocument" {
		t.Fatalf("field schema %+v", field)
	}
	schemas := registry.Map()
	node, mark := schemas["RichTextNode"], schemas["RichTextMark"]
	if schemas["RichTextDocument"] == nil || node == nil || mark == nil {
		t.Fatalf("registered %v", schemas)
	}
	if got := node.Properties["type"].Enum; len(got) != len(richtext.NodeTypes()) || got[0] != richtext.NodeTypes()[0] {
		t.Fatalf("node types %v", got)
	}
	if got := mark.Properties["type"].Enum; len(got) != len(richtext.MarkTypes()) {
		t.Fatalf("mark types %v", got)
	}
	again := registry.Schema(reflect.TypeFor[richtexthttp.Content](), true, "")
	if again.Ref != field.Ref || registry.Map()["RichTextNode"] != node {
		t.Fatal("the schemas are registered once")
	}
}

func TestRequestsAreCheckedAgainstTheContract(t *testing.T) {
	registry := huma.NewMapRegistry("#/components/schemas/", huma.DefaultSchemaNamer)
	schema := registry.Schema(reflect.TypeFor[richtexthttp.Content](), true, "")
	check := func(raw string) []error {
		var value any
		if err := json.Unmarshal([]byte(raw), &value); err != nil {
			t.Fatal(err)
		}
		result := &huma.ValidateResult{}
		huma.Validate(registry, schema, huma.NewPathBuffer([]byte("body.content"), 0), huma.ModeWriteToServer, value, result)
		return result.Errors
	}
	valid := `{"type":"doc","content":[` +
		`{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"bold"},{"type":"link","attrs":{"href":"https://a.example"}}]},{"type":"hard_break"}]},` +
		`{"type":"paragraph","content":[{"type":"text","text":"b","marks":[{"type":"spoiler"}]}]},{"type":"paragraph"}]}`
	if errs := check(valid); len(errs) != 0 {
		t.Fatalf("a valid document is refused: %v", errs)
	}
	for name, raw := range map[string]string{
		"unknown node":        `{"type":"doc","content":[{"type":"image_block"}]}`,
		"unknown mark":        `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"underline"}]}]}]}`,
		"node attributes":     `{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":"center"}}]}`,
		"mark attribute":      `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"link","attrs":{"href":"https://a.example","target":"_blank"}}]}]}]}`,
		"camel case node":     `{"type":"doc","content":[{"type":"hardBreak"}]}`,
		"empty document":      `{"type":"doc","content":[]}`,
		"legacy editor state": `{"root":{"type":"root","children":[]}}`,
	} {
		if errs := check(raw); len(errs) == 0 {
			t.Errorf("%s passes the contract", name)
		}
	}
}
