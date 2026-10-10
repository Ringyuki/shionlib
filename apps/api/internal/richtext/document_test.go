package richtext_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/richtext"
)

type obj = map[string]any

const picture = "richtext/7/0b6f8a52-3c1d-4e8a-9f47-2d5a6c7b8e90.webp"

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

func with(n obj, attrs obj) obj {
	n["attrs"] = attrs
	return n
}

func heading(level int, children ...any) obj {
	return with(block("heading", children...), obj{"level": level})
}

func image(attrs obj) obj {
	return with(block("image_block"), attrs)
}

func cell(kind string, children ...any) obj {
	return with(block(kind, children...), obj{"colspan": 1, "rowspan": 1, "colwidth": nil})
}

func doc(children ...any) []byte {
	raw, err := json.Marshal(block("doc", children...))
	if err != nil {
		panic(err)
	}
	return raw
}

func reason(t *testing.T, raw []byte, schema richtext.Schema) string {
	t.Helper()
	_, err := richtext.Parse(raw, schema)
	var refused *richtext.ContentError
	if !errors.As(err, &refused) {
		t.Fatalf("parse %s: want a content error, got %v", raw, err)
	}
	return refused.Reason
}

func TestADocumentKeepsWhatTheSchemaAllows(t *testing.T) {
	raw := doc(
		heading(2, text("Route")),
		block("paragraph", text("Pick "), text("A", mark("bold"), mark("italic")), block("hard_break"), text("then B", mark("strike"))),
		block("blockquote", block("paragraph", text("quoted", link("https://example.com/a?b=1")))),
		block("ordered_list",
			block("list_item", block("paragraph", text("first")), block("bullet_list", block("list_item", block("paragraph", text("nested"))))),
			block("list_item", block("paragraph", text("hidden", mark("spoiler")))),
		),
		block("horizontal_rule"),
		image(obj{"src": picture, "alt": "map", "caption": "The map", "width": 800, "height": 600, "width_percent": 50}),
		block("table",
			block("table_row", cell("table_header", block("paragraph", text("Choice"))), cell("table_header", block("paragraph", text("Route")))),
			block("table_row",
				with(block("table_cell", block("paragraph", text("A"))), obj{"colspan": 1, "rowspan": 1, "colwidth": nil, "align": "center"}),
				with(block("table_cell", block("paragraph")), obj{"colspan": 1, "rowspan": 1, "colwidth": nil, "align": nil}),
			),
		),
		block("paragraph"),
	)
	document, err := richtext.Parse(raw, richtext.Article)
	if err != nil {
		t.Fatal(err)
	}
	want := "Route\nPick A\nthen B\nquoted\nfirst\nnested\nhidden\nThe map\nChoice\nRoute\nA"
	if got := document.Text(); got != want {
		t.Fatalf("text %q, want %q", got, want)
	}
	if got := document.TextLength(); got != len("RoutePick Athen BquotedfirstnestedhiddenChoiceRouteA") {
		t.Fatalf("length %d", got)
	}
	if got := document.Images(); len(got) != 1 || got[0] != picture {
		t.Fatalf("images %v", got)
	}
	again, err := richtext.Parse(document.Raw(), richtext.Article)
	if err != nil || string(again.Raw()) != string(document.Raw()) {
		t.Fatalf("the stored form does not parse to itself: %v\n%s\n%s", err, document.Raw(), again.Raw())
	}
}

func TestAnExcerptLeavesOutWhatIsHidden(t *testing.T) {
	raw := doc(
		heading(2, text("Common route")),
		block("paragraph", text("Pick A, then "), text("she leaves", mark("spoiler")), text(" in chapter two.")),
		image(obj{"src": picture, "caption": "The map", "width": 800, "height": 600}),
		block("bullet_list", block("list_item", block("paragraph", text("Save"), block("hard_break"), text("often")))),
	)
	document, err := richtext.Parse(raw, richtext.Article)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := document.Excerpt(200), "Common route Pick A, then in chapter two. Save often"; got != want {
		t.Fatalf("excerpt %q, want %q", got, want)
	}
	if got, want := document.Excerpt(12), "Common route"; got != want {
		t.Fatalf("short excerpt %q, want %q", got, want)
	}
	if got := document.Excerpt(0); got != "" {
		t.Fatalf("excerpt of no length %q", got)
	}
	wide, err := richtext.Parse(doc(block("paragraph", text("攻略按章节列出全部选项"))), richtext.Article)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := wide.Excerpt(4), "攻略按章"; got != want {
		t.Fatalf("excerpt %q, want %q", got, want)
	}
}

func TestTheStoredFormIsCanonical(t *testing.T) {
	raw := []byte(` { "content" : [ { "content": [ { "text": "hi", "marks": [], "type": "text" } ], "type": "paragraph", "attrs": null }, { "type": "paragraph", "attrs": {} } ], "type": "doc" } `)
	document, err := richtext.Parse(raw, richtext.Comment)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(document.Raw()), `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]},{"type":"paragraph"}]}`; got != want {
		t.Fatalf("stored %s, want %s", got, want)
	}
	table := doc(block("table", block("table_row", cell("table_cell", block("paragraph")))))
	stored, err := richtext.Parse(table, richtext.Article)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(stored.Raw()), `{"type":"doc","content":[{"type":"table","content":[{"type":"table_row","content":[{"type":"table_cell","attrs":{"colspan":1,"rowspan":1},"content":[{"type":"paragraph"}]}]}]}]}`; got != want {
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
		_, err := richtext.Parse([]byte(raw), richtext.Article)
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
	item := block("list_item", block("paragraph"))
	row := block("table_row", cell("table_cell", block("paragraph")))
	cases := []struct {
		name   string
		raw    []byte
		schema richtext.Schema
		want   string
	}{
		{"empty document", doc(), richtext.Article, "content is empty"},
		{"unknown node", doc(block("code_block")), richtext.Article, `unsupported node type "code_block"`},
		{"camel case name", doc(block("bulletList", item)), richtext.Article, `unsupported node type "bulletList"`},
		{"heading in a comment", doc(heading(2, text("x"))), richtext.Comment, `unsupported node type "heading"`},
		{"list in a comment", doc(block("bullet_list", item)), richtext.Comment, `unsupported node type "bullet_list"`},
		{"quote in a comment", doc(block("blockquote", block("paragraph"))), richtext.Comment, `unsupported node type "blockquote"`},
		{"italic in a comment", doc(block("paragraph", text("x", mark("italic")))), richtext.Comment, `unsupported mark "italic"`},
		{"nested document", doc(block("doc", block("paragraph"))), richtext.Article, `"doc" node cannot be placed there`},
		{"heading level", doc(heading(1, text("x"))), richtext.Article, "unsupported heading level"},
		{"heading without a level", doc(block("heading", text("x"))), richtext.Article, "unsupported heading level"},
		{"attributes on a paragraph", doc(with(block("paragraph"), obj{"level": 2})), richtext.Article, `"paragraph" node takes no attributes`},
		{"attributes of another node", doc(with(block("heading"), obj{"level": 2, "src": picture})), richtext.Article, `"heading" node carries attributes of another node`},
		{"unknown attribute", doc(with(block("paragraph"), obj{"textAlign": "center"})), richtext.Article, `unsupported field "textAlign"`},
		{"unknown node field", doc(obj{"type": "paragraph", "style": "color:red"}), richtext.Article, `unsupported field "style"`},
		{"text at the top", doc(text("x")), richtext.Article, `"text" node cannot be placed there`},
		{"block in a paragraph", doc(block("paragraph", block("paragraph"))), richtext.Article, `"paragraph" node cannot be placed there`},
		{"empty text", doc(block("paragraph", obj{"type": "text", "text": ""})), richtext.Article, "empty text node"},
		{"text on a block", doc(obj{"type": "paragraph", "text": "x"}), richtext.Article, `"paragraph" node takes no text`},
		{"content in a break", doc(block("paragraph", block("hard_break", text("x")))), richtext.Article, `"hard_break" node takes no content`},
		{"content in a rule", doc(block("horizontal_rule", block("paragraph"))), richtext.Article, `"horizontal_rule" node takes no content`},
		{"empty quote", doc(block("blockquote")), richtext.Article, `"blockquote" node needs content`},
		{"list without items", doc(block("bullet_list")), richtext.Article, `"bullet_list" node needs content`},
		{"paragraph in a list", doc(block("bullet_list", block("paragraph"))), richtext.Article, `"paragraph" node cannot be placed there`},
		{"item outside a list", doc(item), richtext.Article, `"list_item" node cannot be placed there`},
		{"item starting with a list", doc(block("ordered_list", block("list_item", block("bullet_list", item)))), richtext.Article, `"bullet_list" node cannot be placed there`},
		{"row outside a table", doc(row), richtext.Article, `"table_row" node cannot be placed there`},
		{"table without rows", doc(block("table")), richtext.Article, `"table" node needs content`},
		{"paragraph in a table", doc(block("table", block("paragraph"))), richtext.Article, `"paragraph" node cannot be placed there`},
		{"list in a cell", doc(block("table", block("table_row", cell("table_cell", block("bullet_list", item))))), richtext.Article, `"bullet_list" node cannot be placed there`},
		{"cell without a span", doc(block("table", block("table_row", block("table_cell", block("paragraph"))))), richtext.Article, "invalid span"},
		{"cell widths against its span", doc(block("table", block("table_row", with(block("table_cell", block("paragraph")), obj{"colspan": 2, "rowspan": 1, "colwidth": []int{120}})))), richtext.Article, "widths do not match"},
		{"image from elsewhere", doc(image(obj{"src": "https://example.com/a.png", "width": 10, "height": 10})), richtext.Article, "not uploaded here"},
		{"image of another kind of key", doc(image(obj{"src": "user/7/avatar/0b6f8a52-3c1d-4e8a-9f47-2d5a6c7b8e90.webp", "width": 10, "height": 10})), richtext.Article, "not uploaded here"},
		{"image without a size", doc(image(obj{"src": picture})), richtext.Article, "without a valid size"},
		{"image shown too narrow", doc(image(obj{"src": picture, "width": 10, "height": 10, "width_percent": 10})), richtext.Article, "invalid display width"},
		{"image shown wider than the column", doc(image(obj{"src": picture, "width": 10, "height": 10, "width_percent": 101})), richtext.Article, "invalid display width"},
		{"cell aligned to nowhere", doc(block("table", block("table_row", with(block("table_cell", block("paragraph")), obj{"colspan": 1, "rowspan": 1, "colwidth": nil, "align": "justify"})))), richtext.Article, "invalid alignment"},
		{"image with a long description", doc(image(obj{"src": picture, "width": 10, "height": 10, "alt": strings.Repeat("a", richtext.MaxAltLength+1)})), richtext.Article, "description is too long"},
		{"image in a comment", doc(image(obj{"src": picture, "width": 10, "height": 10})), richtext.Comment, `unsupported node type "image_block"`},
		{"unknown mark", doc(block("paragraph", text("x", mark("underline")))), richtext.Article, `unsupported mark "underline"`},
		{"repeated mark", doc(block("paragraph", text("x", mark("bold"), mark("bold")))), richtext.Article, `repeats the mark "bold"`},
		{"mark on a block", doc(obj{"type": "paragraph", "marks": []any{mark("bold")}}), richtext.Article, `"paragraph" node takes no marks`},
		{"attributes on a plain mark", doc(block("paragraph", text("x", obj{"type": "bold", "attrs": obj{"href": "https://a.example"}}))), richtext.Article, `"bold" mark takes no attributes`},
		{"link without an address", doc(block("paragraph", text("x", mark("link")))), richtext.Article, "not an http, https or mailto address"},
		{"script link", doc(block("paragraph", text("x", link("javascript:alert(1)")))), richtext.Article, "not an http, https or mailto address"},
		{"disguised script link", doc(block("paragraph", text("x", link("java\tscript:alert(1)")))), richtext.Article, "not an http, https or mailto address"},
		{"relative link", doc(block("paragraph", text("x", link("/zh/game/1")))), richtext.Article, "not an http, https or mailto address"},
		{"overlong link", doc(block("paragraph", text("x", link("https://a.example/"+strings.Repeat("a", richtext.MaxLinkLength))))), richtext.Article, "not an http, https or mailto address"},
	}
	for _, c := range cases {
		if got := reason(t, c.raw, c.schema); !strings.Contains(got, c.want) {
			t.Errorf("%s: reason %q, want it to contain %q", c.name, got, c.want)
		}
	}
}

func TestASchemaLimitsImagesAndTables(t *testing.T) {
	images := make([]any, 51)
	for i := range images {
		images[i] = image(obj{"src": picture, "width": 10, "height": 10})
	}
	if got := reason(t, doc(images...), richtext.Article); got != "content holds more than 50 images" {
		t.Fatalf("reason %q", got)
	}
	if _, err := richtext.Parse(doc(images[:50]...), richtext.Article); err != nil {
		t.Fatal(err)
	}
	tables := make([]any, 21)
	for i := range tables {
		tables[i] = block("table", block("table_row", cell("table_cell", block("paragraph"))))
	}
	if got := reason(t, doc(tables...), richtext.Article); got != "content holds more than 20 tables" {
		t.Fatalf("reason %q", got)
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

func TestDeepNestingIsRefused(t *testing.T) {
	inner := block("paragraph", text("x"))
	for range 40 {
		inner = block("blockquote", inner)
	}
	if got := reason(t, doc(inner), richtext.Article); got != "content is nested too deeply" {
		t.Fatalf("reason %q", got)
	}
}

func TestImageKeysNameTheirOwner(t *testing.T) {
	key := richtext.ImageKey(7, "0b6f8a52-3c1d-4e8a-9f47-2d5a6c7b8e90.webp")
	if key != picture || !richtext.IsImageKey(key) {
		t.Fatalf("key %q", key)
	}
	for _, other := range []string{"", "richtext/0/x.webp", "richtext/7/../x.webp", picture + "?x", "https://cdn.example/" + picture} {
		if richtext.IsImageKey(other) {
			t.Errorf("%q passes for an image key", other)
		}
	}
}

func TestVocabularyIsExposedForTheContract(t *testing.T) {
	nodes, marks := richtext.NodeTypes(), richtext.MarkTypes()
	if len(nodes) != 14 || len(marks) != 5 {
		t.Fatalf("nodes %v marks %v", nodes, marks)
	}
	nodes[0] = "changed"
	if richtext.NodeTypes()[0] == "changed" {
		t.Fatal("the vocabulary must not be shared")
	}
}
