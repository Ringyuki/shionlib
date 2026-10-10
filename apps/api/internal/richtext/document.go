package richtext

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf16"
)

const maxDepth = 32

var ErrNotDocument = errors.New("content is not a rich text document")

type ContentError struct {
	Reason string
}

func (e *ContentError) Error() string {
	return e.Reason
}

type node struct {
	Type    string     `json:"type"`
	Attrs   *nodeAttrs `json:"attrs,omitempty"`
	Content []*node    `json:"content,omitempty"`
	Marks   []mark     `json:"marks,omitempty"`
	Text    string     `json:"text,omitempty"`
}

type nodeAttrs struct {
	Level        int    `json:"level,omitempty"`
	Src          string `json:"src,omitempty"`
	Alt          string `json:"alt,omitempty"`
	Caption      string `json:"caption,omitempty"`
	Width        int    `json:"width,omitempty"`
	Height       int    `json:"height,omitempty"`
	WidthPercent int    `json:"width_percent,omitempty"`
	Colspan      int    `json:"colspan,omitempty"`
	Rowspan      int    `json:"rowspan,omitempty"`
	Colwidth     []int  `json:"colwidth,omitempty"`
	Align        string `json:"align,omitempty"`
}

type mark struct {
	Type  string     `json:"type"`
	Attrs *markAttrs `json:"attrs,omitempty"`
}

type markAttrs struct {
	Href string `json:"href,omitempty"`
}

type Document struct {
	raw  json.RawMessage
	root *node
}

func Parse(raw []byte, schema Schema) (Document, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '{' || bytes.Contains(trimmed, []byte(`\u0000`)) {
		return Document{}, ErrNotDocument
	}
	var root node
	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&root); err != nil {
		return Document{}, notDocument(err)
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		return Document{}, ErrNotDocument
	}
	if root.Type != nodeDocument {
		return Document{}, ErrNotDocument
	}
	if err := schema.check(&root); err != nil {
		return Document{}, err
	}
	canonical, err := json.Marshal(&root)
	if err != nil {
		return Document{}, fmt.Errorf("encode rich text document: %w", err)
	}
	return Document{raw: canonical, root: &root}, nil
}

func notDocument(err error) error {
	const unknownField = "json: unknown field "
	if field, ok := strings.CutPrefix(err.Error(), unknownField); ok {
		return &ContentError{Reason: "content contains an unsupported field " + field}
	}
	return ErrNotDocument
}

func (d Document) Raw() json.RawMessage {
	return d.raw
}

func (d Document) Empty() bool {
	return d.root == nil
}

func (d Document) Text() string {
	if d.root == nil {
		return ""
	}
	var b strings.Builder
	d.root.writeText(&b)
	return strings.TrimRight(b.String(), "\n")
}

func (d Document) TextLength() int {
	if d.root == nil {
		return 0
	}
	return d.root.textLength()
}

func (d Document) Images() []string {
	if d.root == nil {
		return nil
	}
	var sources []string
	d.root.walk(func(n *node) {
		if n.Type == nodeImage && n.Attrs != nil {
			sources = append(sources, n.Attrs.Src)
		}
	})
	return sources
}

func (n *node) walk(visit func(*node)) {
	visit(n)
	for _, child := range n.Content {
		child.walk(visit)
	}
}

func (n *node) writeText(b *strings.Builder) {
	switch n.Type {
	case nodeText:
		b.WriteString(n.Text)
		return
	case nodeHardBreak:
		b.WriteByte('\n')
		return
	case nodeImage:
		if n.Attrs != nil && n.Attrs.Caption != "" {
			b.WriteString(n.Attrs.Caption)
			b.WriteByte('\n')
		}
		return
	}
	for _, child := range n.Content {
		child.writeText(b)
	}
	if specs[n.Type].content == inlineContent {
		b.WriteByte('\n')
	}
}

func (n *node) textLength() int {
	length := 0
	for _, r := range n.Text {
		length += max(utf16.RuneLen(r), 1)
	}
	for _, child := range n.Content {
		length += child.textLength()
	}
	return length
}
