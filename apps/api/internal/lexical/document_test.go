package lexical_test

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/lexical"
)

type obj = map[string]any

func text(value string, format int, style string) obj {
	return obj{"type": "text", "version": 1, "text": value, "format": format, "style": style, "mode": "normal", "detail": 0}
}

func element(kind string, children []any, extra obj) obj {
	n := obj{"type": kind, "version": 1, "format": "", "indent": 0, "direction": "ltr", "children": children}
	for key, value := range extra {
		n[key] = value
	}
	return n
}

func paragraph(children ...any) obj {
	return element("paragraph", children, nil)
}

func doc(children ...any) []byte {
	raw, err := json.Marshal(obj{"root": element("root", children, nil)})
	if err != nil {
		panic(err)
	}
	return raw
}

func render(t *testing.T, raw []byte) string {
	t.Helper()
	document, err := lexical.Parse(raw)
	if err != nil {
		t.Fatalf("parse %s: %v", raw, err)
	}
	return document.HTML()
}

const p = `<p class="[&amp;:not(:first-child)]:mt-6">`

func TestRenderMatchesLegacyMarkup(t *testing.T) {
	cases := []struct {
		name string
		raw  []byte
		want string
	}{
		{"plain", doc(paragraph(text("Hello world", 0, ""))), p + `<span>Hello world</span></p>`},
		{"empty paragraph", doc(paragraph()), p + `<br /></p>`},
		{"text formats", doc(paragraph(text("b", 1, ""), text("i", 2, ""), text("us", 12, ""), text("all", 15, ""), text("hl", 128, ""), text("bcode", 17, ""), text("x", 33, ""), text("y", 96, ""), text("low", 256, ""))),
			p + `<b><strong class="font-bold">b</strong></b><i><em class="italic">i</em></i><u><s><span class="underline line-through">us</span></s></u><u><s><i><b><strong class="underline line-through font-bold italic">all</strong></b></i></s></u><mark><span>hl</span></mark><b><code spellcheck="false"><strong class="font-bold bg-card-hover p-1 rounded-md">bcode</strong></code></b><b><sub><strong class="font-bold sub">x</strong></sub></b><sub><span class="sub sup">y</span></sub><span>low</span></p>`},
		{"styles are filtered to the legacy allow-list", doc(paragraph(
			text("a", 0, "color: #ff0000;"),
			text("b", 0, "font-size: 40px;"),
			text("c", 0, "color: red; background-image: url(javascript:alert(1)); position: fixed"),
			text("d", 1, "color: rgba(1,2,3,0.5); font-size: 15px"),
			text("e", 0, "COLOR: #FFF"),
			text("f", 0, "color: #ff0000; color: #00ff00"),
			text("g", 0, "color: #ff0000 !important"),
		)), p + `<span style="color:#ff0000">a</span><span>b</span><span>c</span><b><strong class="font-bold" style="color:rgba(1,2,3,0.5);font-size:15px">d</strong></b><span>e</span><span style="color:#00ff00">f</span><span style="color:#ff0000 !important">g</span></p>`},
		{"alignment", doc(element("paragraph", []any{text("c", 0, "")}, obj{"format": "center"}), element("paragraph", []any{text("s", 0, "")}, obj{"format": "start"}), element("quote", []any{text("q", 0, "")}, obj{"format": 3})),
			`<p class="[&amp;:not(:first-child)]:mt-6" style="text-align:center"><span>c</span></p>` + p + `<span>s</span></p><blockquote class="mt-6 border-l-2 pl-6 italic" style="text-align:right"><span>q</span></blockquote>`},
		{"headings", doc(element("heading", []any{text("t", 0, "")}, obj{"tag": "h2"}), element("heading", nil, obj{"tag": "h3"})),
			`<h2 class="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0"><span>t</span></h2><h3 class="scroll-m-20 text-2xl font-semibold tracking-tight"><br /></h3>`},
		{"nested and check lists", doc(
			element("list", []any{
				element("listitem", []any{text("three", 0, "")}, obj{"value": 3}),
				element("listitem", []any{element("list", []any{element("listitem", []any{text("nested", 0, "")}, nil)}, obj{"listType": "number", "tag": "ol"})}, nil),
			}, obj{"listType": "number", "tag": "ol", "start": 3}),
			element("list", []any{element("listitem", []any{text("todo", 0, "")}, obj{"checked": false})}, obj{"listType": "check", "tag": "ul"}),
		), `<ol class="m-0 p-0 list-decimal [&amp;&gt;li]:mt-2 list-outside !list-decimal"><li class="mx-8"><span>three</span></li><li class="mx-8 list-none before:hidden after:hidden"><ol class="m-0 p-0 list-decimal [&amp;&gt;li]:mt-2 list-outside !list-[upper-roman]"><li class="mx-8"><span>nested</span></li></ol></li></ol>` +
			`<ul class="m-0 p-0 list-outside [&amp;&gt;li]:mt-2 relative !list-disc"><li class="mx-8 relative mx-2 px-6 list-none outline-none before:content-[&quot;&quot;] before:w-4 before:h-4 before:top-0.5 before:mt-0.5 before:left-0 before:cursor-pointer before:block before:bg-cover before:absolute before:border before:border-primary before:rounded"><span>todo</span></li></ul>`},
		{"links keep only safe urls and targets", doc(paragraph(
			element("link", []any{text("ok", 0, "")}, obj{"url": "https://example.com/a?b=1&c=2", "target": "_blank", "rel": "noreferrer", "title": "T"}),
			element("link", []any{text("js", 0, "")}, obj{"url": " JaVa script:alert(1)"}),
			element("link", []any{text("data", 0, "")}, obj{"url": "data:text/html,x", "target": `x" y`}),
			element("autolink", []any{text("u", 0, "")}, obj{"url": "https://u.example", "isUnlinked": true}),
			element("link", []any{text("rel", 0, "")}, obj{"url": "/game/1"}),
		)), p + `<a class="text-blue-600 hover:underline hover:cursor-pointer" href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer"><span>ok</span></a><a class="text-blue-600 hover:underline hover:cursor-pointer" rel="noopener noreferrer"><span>js</span></a><a class="text-blue-600 hover:underline hover:cursor-pointer" rel="noopener noreferrer"><span>data</span></a><span><span>u</span></span><a class="text-blue-600 hover:underline hover:cursor-pointer" href="/game/1" rel="noopener noreferrer"><span>rel</span></a></p>`},
		{"hashtag", doc(paragraph(obj{"type": "hashtag", "text": "#t", "format": 1, "style": "color: #fff"})),
			p + `<b><strong class="font-bold text-blue-600 bg-blue-100 rounded-md px-1" style="color:#fff">#t</strong></b></p>`},
		{"table", doc(element("table", []any{
			element("tablerow", []any{
				element("tablecell", []any{paragraph(text("h", 0, ""))}, obj{"headerState": 1, "colSpan": 2}),
			}, nil),
			element("tablerow", []any{
				element("tablecell", nil, obj{"headerState": 0, "backgroundColor": "#eeeeee"}),
				element("tablecell", nil, obj{"headerState": 0, "backgroundColor": "red;position:fixed"}),
			}, nil),
		}, nil)), `<table class="EditorTheme__table w-fit overflow-scroll border-collapse"><colgroup><col /><col /></colgroup><tbody><tr><th class="EditorTheme__tableCell w-24 relative border px-4 py-2 text-left [&amp;[align=center]]:text-center [&amp;[align=right]]:text-right&quot; EditorTheme__tableCellHeader bg-muted font-bold [&amp;[align=right]]:text-right" style="background-color:#f2f3f5">` + p + `<span>h</span></p></th></tr><tr><td class="EditorTheme__tableCell w-24 relative border px-4 py-2 text-left [&amp;[align=center]]:text-center [&amp;[align=right]]:text-right&quot;" style="background-color:#eeeeee"></td><td class="EditorTheme__tableCell w-24 relative border px-4 py-2 text-left [&amp;[align=center]]:text-center [&amp;[align=right]]:text-right&quot;"></td></tr></tbody></table>`},
		{"code block", doc(element("code", []any{
			obj{"type": "code-highlight", "text": "const", "highlightType": "keyword"},
			obj{"type": "code-highlight", "text": ` "<b>"`, "highlightType": "string", "format": 1},
			obj{"type": "linebreak"},
			obj{"type": "tab", "text": "\t"},
			obj{"type": "code-highlight", "text": "a\nb"},
		}, obj{"language": "JavaScript"})), `<pre class="EditorTheme__code" data-language="javascript" data-highlight-language="javascript" data-gutter="1` + "\n" + `2" spellcheck="false"><span class="EditorTheme__tokenAttr">const</span><span class="EditorTheme__tokenSelector"> "&lt;b&gt;"</span><br /><span>` + "\t" + `</span><span>a` + "\n" + `b</span></pre>`},
		{"code gutter falls back to text lines and unsafe languages become plaintext", doc(element("code", []any{obj{"type": "code-highlight", "text": "a\nb\nc"}}, obj{"language": `js" onclick="x`})),
			`<pre class="EditorTheme__code" data-language="plaintext" data-highlight-language="plaintext" data-gutter="1` + "\n2\n3" + `" spellcheck="false"><span>a` + "\nb\nc" + `</span></pre>`},
		{"breaks, rules, overflow and escaping", doc(
			paragraph(text("a\r\nb", 0, ""), obj{"type": "linebreak"}, element("overflow", []any{text("over", 0, "")}, nil), text("x\ny", 16, "")),
			obj{"type": "horizontalrule"},
			paragraph(text(`<script>alert(1)</script> & "q" 's'`, 0, "")),
		), p + `<span>a<br />b</span><br /><span>over</span><code spellcheck="false"><span class="bg-card-hover p-1 rounded-md">x` + "\n" + `y</span></code></p><hr />` + p + `<span>&lt;script&gt;alert(1)&lt;/script&gt; &amp; "q" 's'</span></p>`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := render(t, c.raw); got != c.want {
				t.Fatalf("unexpected html\n got %s\nwant %s", got, c.want)
			}
		})
	}
}

func TestParseRejectsUnsupportedContent(t *testing.T) {
	deep := paragraph(text("x", 0, ""))
	for range 120 {
		deep = element("quote", []any{deep}, nil)
	}
	cases := []struct {
		name   string
		raw    string
		reason string
	}{
		{"array", `[]`, ""},
		{"string", `"x"`, ""},
		{"missing root", `{}`, ""},
		{"root of wrong type", `{"root":{"type":"paragraph","children":[]}}`, ""},
		{"malformed node", `{"root":{"type":"root","children":[{"type":"text","text":5}]}}`, ""},
		{"nul escape", `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"\u0000"}]}]}}`, ""},
		{"empty", string(doc()), "content is empty"},
		{"image", string(doc(obj{"type": "image", "src": "x"})), `content contains an unsupported node type "image"`},
		{"keyword", string(doc(paragraph(obj{"type": "keyword", "text": "congrats"}))), `content contains an unsupported node type "keyword"`},
		{"nested root", string(doc(element("root", nil, nil))), `content contains an unsupported node type "root"`},
		{"heading tag", string(doc(element("heading", []any{text("x", 0, "")}, obj{"tag": "h9"}))), `content contains an unsupported heading tag "h9"`},
		{"too deep", string(doc(deep)), "content is nested too deeply"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := lexical.Parse([]byte(c.raw))
			if c.reason == "" {
				if !errors.Is(err, lexical.ErrNotDocument) {
					t.Fatalf("expected ErrNotDocument, got %v", err)
				}
				return
			}
			var contentErr *lexical.ContentError
			if !errors.As(err, &contentErr) || contentErr.Reason != c.reason {
				t.Fatalf("expected %q, got %v", c.reason, err)
			}
		})
	}
}

func TestTextMatchesTheLegacyEditorLength(t *testing.T) {
	raw := doc(
		paragraph(text("foo", 0, ""), text("bar", 1, "")),
		paragraph(element("link", []any{text("click", 0, "")}, obj{"url": "https://x"}), obj{"type": "linebreak"}),
		element("code", []any{obj{"type": "code-highlight", "text": "x"}, obj{"type": "tab", "text": "\t"}}, nil),
		paragraph(text("😀中", 0, "")),
	)
	document, err := lexical.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got := document.Text(); got != "foobarclickx\t😀中" {
		t.Fatalf("unexpected text %q", got)
	}
	if got := document.TextLength(); got != 16 {
		t.Fatalf("length counts UTF-16 code units like JavaScript, got %d", got)
	}
	if !strings.HasPrefix(string(document.Raw()), `{"root"`) {
		t.Fatalf("raw content must be kept for storage: %s", document.Raw())
	}
}
