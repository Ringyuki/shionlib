package richtext_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

type obj = map[string]any

func text(value string, marks ...any) obj {
	n := obj{"type": "text", "text": value}
	if len(marks) > 0 {
		n["marks"] = marks
	}
	return n
}

func mark(kind string) obj {
	return obj{"type": kind}
}

func link(href string) obj {
	return obj{"type": "link", "attrs": obj{"href": href}}
}

func block(kind string, children ...any) obj {
	n := obj{"type": kind}
	if len(children) > 0 {
		n["content"] = children
	}
	return n
}

func doc(children ...any) []byte {
	raw, err := json.Marshal(block("doc", children...))
	if err != nil {
		panic(err)
	}
	return raw
}

func reason(t *testing.T, raw []byte) string {
	t.Helper()
	_, err := richtext.Parse(raw, richtext.Comment)
	var refused *richtext.ContentError
	if !errors.As(err, &refused) {
		t.Fatalf("parse %s: want a content error, got %v", raw, err)
	}
	return refused.Reason
}

func TestADocumentKeepsWhatTheSchemaAllows(t *testing.T) {
	raw := doc(
		block("paragraph", text("Pick "), text("A", mark("bold")), block("hard_break"), text("then B")),
		block("paragraph", text("see ", mark("bold")), text("the guide", mark("bold"), link("https://example.com/a?b=1"))),
		block("paragraph", text("hidden", mark("spoiler"))),
		block("paragraph"),
	)
	document, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := document.Text(), "Pick A\nthen B\nsee the guide\nhidden"; got != want {
		t.Fatalf("text %q, want %q", got, want)
	}
	if got := document.TextLength(); got != len("Pick Athen Bsee the guidehidden") {
		t.Fatalf("length %d", got)
	}
	if document.Empty() || !(richtext.Document{}).Empty() {
		t.Fatal("only a document that was never parsed is empty")
	}
	again, err := richtext.Parse(document.Raw(), richtext.Comment)
	if err != nil || string(again.Raw()) != string(document.Raw()) {
		t.Fatalf("the stored form does not parse to itself: %v\n%s\n%s", err, document.Raw(), again.Raw())
	}
}

func TestTheStoredFormIsCanonical(t *testing.T) {
	raw := []byte(` { "content" : [ { "content": [ { "text": "hi", "marks": [], "type": "text" } ], "type": "paragraph" }, { "type": "paragraph", "content": [] } ], "type": "doc" } `)
	document, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(document.Raw()), `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]},{"type":"paragraph"}]}`; got != want {
		t.Fatalf("stored %s, want %s", got, want)
	}
}

func TestLengthCountsUTF16UnitsLikeTheBrowser(t *testing.T) {
	document, err := richtext.Parse(doc(block("paragraph", text("書音😀"))), richtext.Comment)
	if err != nil || document.TextLength() != 4 {
		t.Fatalf("length %d, error %v", document.TextLength(), err)
	}
}

func TestWhatIsNotADocumentIsRejected(t *testing.T) {
	for name, raw := range map[string]string{
		"blank":               "  ",
		"string":              `"text"`,
		"array":               `[]`,
		"wrong root":          `{"type":"paragraph"}`,
		"trailing data":       `{"type":"doc","content":[{"type":"paragraph"}]} {}`,
		"null child":          `{"type":"doc","content":[null]}`,
		"null character":      `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"a\u0000b"}]}]}`,
		"malformed":           `{"type":"doc",`,
		"wrong field types":   `{"type":"doc","content":{}}`,
		"legacy editor state": `{"root":{"type":"root","children":[]}}`,
	} {
		_, err := richtext.Parse([]byte(raw), richtext.Comment)
		var refused *richtext.ContentError
		if name == "legacy editor state" && errors.As(err, &refused) {
			continue
		}
		if !errors.Is(err, richtext.ErrNotDocument) {
			t.Errorf("%s: got %v", name, err)
		}
	}
}

func TestContentOutsideTheSchemaIsRefusedWithAReason(t *testing.T) {
	cases := []struct {
		name string
		raw  []byte
		want string
	}{
		{"empty document", doc(), "content is empty"},
		{"unknown node", doc(block("code_block")), `unsupported node type "code_block"`},
		{"heading", doc(obj{"type": "heading", "content": []any{text("x")}}), `unsupported node type "heading"`},
		{"list", doc(block("bullet_list", block("list_item", block("paragraph")))), `unsupported node type "bullet_list"`},
		{"picture", doc(block("image_block")), `unsupported node type "image_block"`},
		{"camel case name", doc(block("paragraph", block("hardBreak"))), `unsupported node type "hardBreak"`},
		{"nested document", doc(block("doc", block("paragraph"))), `"doc" node cannot be placed there`},
		{"attributes on a node", doc(obj{"type": "paragraph", "attrs": obj{"level": 2}}), `unsupported field "attrs"`},
		{"unknown node field", doc(obj{"type": "paragraph", "style": "color:red"}), `unsupported field "style"`},
		{"text at the top", doc(text("x")), `"text" node cannot be placed there`},
		{"block in a paragraph", doc(block("paragraph", block("paragraph"))), `"paragraph" node cannot be placed there`},
		{"empty text", doc(block("paragraph", obj{"type": "text", "text": ""})), "empty text node"},
		{"text on a block", doc(obj{"type": "paragraph", "text": "x"}), `"paragraph" node takes no text`},
		{"content in a break", doc(block("paragraph", block("hard_break", text("x")))), `"hard_break" node takes no content`},
		{"italic", doc(block("paragraph", text("x", mark("italic")))), `unsupported mark "italic"`},
		{"unknown mark", doc(block("paragraph", text("x", mark("underline")))), `unsupported mark "underline"`},
		{"repeated mark", doc(block("paragraph", text("x", mark("bold"), mark("bold")))), `repeats the mark "bold"`},
		{"mark on a block", doc(obj{"type": "paragraph", "marks": []any{mark("bold")}}), `"paragraph" node takes no marks`},
		{"attributes on a plain mark", doc(block("paragraph", text("x", obj{"type": "bold", "attrs": obj{"href": "https://a.example"}}))), `"bold" mark takes no attributes`},
		{"unknown mark attribute", doc(block("paragraph", text("x", obj{"type": "link", "attrs": obj{"href": "https://a.example", "target": "_blank"}}))), `unsupported field "target"`},
		{"link without an address", doc(block("paragraph", text("x", mark("link")))), "not an http, https or mailto address"},
		{"script link", doc(block("paragraph", text("x", link("javascript:alert(1)")))), "not an http, https or mailto address"},
		{"disguised script link", doc(block("paragraph", text("x", link("java\tscript:alert(1)")))), "not an http, https or mailto address"},
		{"relative link", doc(block("paragraph", text("x", link("/zh/game/1")))), "not an http, https or mailto address"},
		{"overlong link", doc(block("paragraph", text("x", link("https://a.example/"+strings.Repeat("a", richtext.MaxLinkLength))))), "not an http, https or mailto address"},
	}
	for _, c := range cases {
		if got := reason(t, c.raw); !strings.Contains(got, c.want) {
			t.Errorf("%s: reason %q, want it to contain %q", c.name, got, c.want)
		}
	}
}

func TestBreaksMayKeepTheMarksAroundThem(t *testing.T) {
	raw := doc(block("paragraph", text("a", mark("bold")), obj{"type": "hard_break", "marks": []any{mark("bold")}}, text("b", mark("bold"))))
	if _, err := richtext.Parse(raw, richtext.Comment); err != nil {
		t.Fatal(err)
	}
}

func TestLinksMayBeHTTPOrMail(t *testing.T) {
	for _, href := range []string{"http://a.example", "HTTPS://A.example/路径?q=1#x", "mailto:someone@example.com"} {
		if _, err := richtext.Parse(doc(block("paragraph", text("x", link(href)))), richtext.Comment); err != nil {
			t.Errorf("%s: %v", href, err)
		}
	}
}

func TestVocabularyIsExposedForTheContract(t *testing.T) {
	nodes, marks := richtext.NodeTypes(), richtext.MarkTypes()
	if len(nodes) != 3 || len(marks) != 3 {
		t.Fatalf("nodes %v marks %v", nodes, marks)
	}
	nodes[0] = "changed"
	if richtext.NodeTypes()[0] == "changed" {
		t.Fatal("the vocabulary must not be shared")
	}
}
