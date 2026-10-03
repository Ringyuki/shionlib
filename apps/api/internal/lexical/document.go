package lexical

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf16"
)

const maxDepth = 100

var ErrNotDocument = errors.New("content is not an editor document")

type ContentError struct {
	Reason string
}

func (e *ContentError) Error() string {
	return e.Reason
}

const (
	typeRoot           = "root"
	typeParagraph      = "paragraph"
	typeHeading        = "heading"
	typeQuote          = "quote"
	typeList           = "list"
	typeListItem       = "listitem"
	typeLink           = "link"
	typeAutoLink       = "autolink"
	typeText           = "text"
	typeHashtag        = "hashtag"
	typeLineBreak      = "linebreak"
	typeTab            = "tab"
	typeCode           = "code"
	typeCodeHighlight  = "code-highlight"
	typeHorizontalRule = "horizontalrule"
	typeOverflow       = "overflow"
	typeTable          = "table"
	typeTableRow       = "tablerow"
	typeTableCell      = "tablecell"
)

var supportedTypes = []string{
	typeParagraph, typeHeading, typeQuote, typeList, typeListItem, typeLink, typeAutoLink,
	typeText, typeHashtag, typeLineBreak, typeTab, typeCode, typeCodeHighlight,
	typeHorizontalRule, typeOverflow, typeTable, typeTableRow, typeTableCell,
}

var headingTags = []string{"h1", "h2", "h3", "h4", "h5", "h6"}

type node struct {
	Type            string          `json:"type"`
	Children        []*node         `json:"children"`
	Text            *string         `json:"text"`
	Format          json.RawMessage `json:"format"`
	Style           string          `json:"style"`
	Tag             string          `json:"tag"`
	ListType        string          `json:"listType"`
	Checked         *bool           `json:"checked"`
	URL             string          `json:"url"`
	Target          *string         `json:"target"`
	IsUnlinked      bool            `json:"isUnlinked"`
	Language        *string         `json:"language"`
	HighlightType   *string         `json:"highlightType"`
	HeaderState     int             `json:"headerState"`
	ColSpan         *int            `json:"colSpan"`
	BackgroundColor *string         `json:"backgroundColor"`
}

type Document struct {
	raw  json.RawMessage
	root *node
}

func Parse(raw []byte) (Document, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '{' || bytes.Contains(trimmed, []byte(`\u0000`)) {
		return Document{}, ErrNotDocument
	}
	var envelope struct {
		Root *node `json:"root"`
	}
	if err := json.Unmarshal(trimmed, &envelope); err != nil {
		return Document{}, ErrNotDocument
	}
	if envelope.Root == nil || envelope.Root.Type != typeRoot {
		return Document{}, ErrNotDocument
	}
	if len(envelope.Root.Children) == 0 {
		return Document{}, &ContentError{Reason: "content is empty"}
	}
	for _, child := range envelope.Root.Children {
		if err := validate(child, 1); err != nil {
			return Document{}, err
		}
	}
	return Document{raw: json.RawMessage(bytes.Clone(trimmed)), root: envelope.Root}, nil
}

func validate(n *node, depth int) error {
	if n == nil {
		return ErrNotDocument
	}
	if depth > maxDepth {
		return &ContentError{Reason: "content is nested too deeply"}
	}
	if !slices.Contains(supportedTypes, n.Type) {
		return &ContentError{Reason: fmt.Sprintf("content contains an unsupported node type %q", n.Type)}
	}
	if n.Type == typeHeading && !slices.Contains(headingTags, n.Tag) {
		return &ContentError{Reason: fmt.Sprintf("content contains an unsupported heading tag %q", n.Tag)}
	}
	for _, child := range n.Children {
		if err := validate(child, depth+1); err != nil {
			return err
		}
	}
	return nil
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
	return b.String()
}

func (d Document) TextLength() int {
	length := 0
	for _, r := range d.Text() {
		length += max(utf16.RuneLen(r), 1)
	}
	return length
}

func (n *node) writeText(b *strings.Builder) {
	if n.Text != nil {
		b.WriteString(*n.Text)
		return
	}
	for _, child := range n.Children {
		child.writeText(b)
	}
}
