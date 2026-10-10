package richtext

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	nodeDocument       = "doc"
	nodeParagraph      = "paragraph"
	nodeHeading        = "heading"
	nodeBlockquote     = "blockquote"
	nodeBulletList     = "bullet_list"
	nodeOrderedList    = "ordered_list"
	nodeListItem       = "list_item"
	nodeHorizontalRule = "horizontal_rule"
	nodeImage          = "image_block"
	nodeTable          = "table"
	nodeTableRow       = "table_row"
	nodeTableHeader    = "table_header"
	nodeTableCell      = "table_cell"
	nodeHardBreak      = "hard_break"
	nodeText           = "text"
)

const (
	markBold    = "bold"
	markItalic  = "italic"
	markStrike  = "strike"
	markLink    = "link"
	markSpoiler = "spoiler"
)

const (
	MaxLinkLength  = 2000
	MaxCellSpan    = 50
	MaxColumnWidth = 2000
)

var HeadingLevels = []int{2, 3}

var CellAlignments = []string{"left", "center", "right"}

var linkSchemes = []string{"http", "https", "mailto"}

type contentRule int

const (
	noContent contentRule = iota
	inlineContent
	blockContent
	listContent
	itemContent
	tableContent
	rowContent
	cellContent
)

type nodeSpec struct {
	block   bool
	inline  bool
	content contentRule
}

var specs = map[string]nodeSpec{
	nodeDocument:       {content: blockContent},
	nodeParagraph:      {block: true, content: inlineContent},
	nodeHeading:        {block: true, content: inlineContent},
	nodeBlockquote:     {block: true, content: blockContent},
	nodeBulletList:     {block: true, content: listContent},
	nodeOrderedList:    {block: true, content: listContent},
	nodeListItem:       {content: itemContent},
	nodeHorizontalRule: {block: true},
	nodeImage:          {block: true},
	nodeTable:          {block: true, content: tableContent},
	nodeTableRow:       {content: rowContent},
	nodeTableHeader:    {content: cellContent},
	nodeTableCell:      {content: cellContent},
	nodeHardBreak:      {inline: true},
	nodeText:           {inline: true},
}

var nodeTypes = []string{
	nodeParagraph, nodeHeading, nodeBlockquote, nodeBulletList, nodeOrderedList, nodeListItem,
	nodeHorizontalRule, nodeImage, nodeTable, nodeTableRow, nodeTableHeader, nodeTableCell,
	nodeHardBreak, nodeText,
}

var markTypes = []string{markBold, markItalic, markStrike, markLink, markSpoiler}

type Schema struct {
	nodes     []string
	marks     []string
	maxImages int
	maxTables int
}

var (
	Comment = Schema{
		nodes: []string{nodeParagraph, nodeHardBreak, nodeText},
		marks: []string{markBold, markLink, markSpoiler},
	}
	Article = Schema{nodes: nodeTypes, marks: markTypes, maxImages: 50, maxTables: 20}
)

func NodeTypes() []string {
	return slices.Clone(nodeTypes)
}

func MarkTypes() []string {
	return slices.Clone(markTypes)
}

type tally struct {
	images int
	tables int
}

func (s Schema) check(root *node) error {
	var seen tally
	if err := s.checkNode(root, 0, &seen); err != nil {
		return err
	}
	if seen.images > s.maxImages {
		return &ContentError{Reason: fmt.Sprintf("content holds more than %d images", s.maxImages)}
	}
	if seen.tables > s.maxTables {
		return &ContentError{Reason: fmt.Sprintf("content holds more than %d tables", s.maxTables)}
	}
	return nil
}

func (s Schema) checkNode(n *node, depth int, seen *tally) error {
	if n == nil {
		return ErrNotDocument
	}
	if depth > maxDepth {
		return &ContentError{Reason: "content is nested too deeply"}
	}
	spec, known := specs[n.Type]
	if !known || (n.Type != nodeDocument && !slices.Contains(s.nodes, n.Type)) {
		return refuse("content contains an unsupported node type %q", n.Type)
	}
	switch n.Type {
	case nodeImage:
		seen.images++
	case nodeTable:
		seen.tables++
	}
	if err := s.checkOwn(n, spec); err != nil {
		return err
	}
	if err := checkChildren(n, spec.content); err != nil {
		return err
	}
	for _, child := range n.Content {
		if err := s.checkNode(child, depth+1, seen); err != nil {
			return err
		}
	}
	return nil
}

func (s Schema) checkOwn(n *node, spec nodeSpec) error {
	if n.Type == nodeText && n.Text == "" {
		return &ContentError{Reason: "content contains an empty text node"}
	}
	if n.Type != nodeText && n.Text != "" {
		return refuse("a %q node takes no text", n.Type)
	}
	if err := checkAttrs(n); err != nil {
		return err
	}
	if len(n.Marks) > 0 && !spec.inline {
		return refuse("a %q node takes no marks", n.Type)
	}
	return s.checkMarks(n.Marks)
}

func (s Schema) checkMarks(marks []mark) error {
	seen := make([]string, 0, len(marks))
	for _, m := range marks {
		if !slices.Contains(s.marks, m.Type) {
			return refuse("content contains an unsupported mark %q", m.Type)
		}
		if slices.Contains(seen, m.Type) {
			return refuse("content repeats the mark %q on one node", m.Type)
		}
		seen = append(seen, m.Type)
		if m.Type != markLink {
			if m.Attrs != nil {
				return refuse("a %q mark takes no attributes", m.Type)
			}
			continue
		}
		if m.Attrs == nil || !linkAllowed(m.Attrs.Href) {
			return &ContentError{Reason: "content contains a link that is not an http, https or mailto address"}
		}
	}
	return nil
}

func checkChildren(n *node, rule contentRule) error {
	if rule == noContent && len(n.Content) > 0 {
		return refuse("a %q node takes no content", n.Type)
	}
	if rule != noContent && rule != inlineContent && len(n.Content) == 0 {
		if n.Type == nodeDocument {
			return &ContentError{Reason: "content is empty"}
		}
		return refuse("a %q node needs content", n.Type)
	}
	for index, child := range n.Content {
		if child == nil {
			return ErrNotDocument
		}
		if _, known := specs[child.Type]; !known {
			return refuse("content contains an unsupported node type %q", child.Type)
		}
		if !fits(rule, index, child.Type) {
			return refuse("a %q node cannot be placed there", child.Type)
		}
	}
	return nil
}

func fits(rule contentRule, index int, child string) bool {
	spec := specs[child]
	switch rule {
	case inlineContent:
		return spec.inline
	case blockContent:
		return spec.block
	case listContent:
		return child == nodeListItem
	case itemContent:
		if index == 0 {
			return child == nodeParagraph
		}
		return spec.block
	case tableContent:
		return child == nodeTableRow
	case rowContent:
		return child == nodeTableHeader || child == nodeTableCell
	case cellContent:
		return child == nodeParagraph
	}
	return false
}

func linkAllowed(href string) bool {
	if href == "" || utf8.RuneCountInString(href) > MaxLinkLength || href != strings.TrimSpace(href) {
		return false
	}
	if strings.ContainsFunc(href, func(r rune) bool { return r <= 0x20 || r == 0x7f }) {
		return false
	}
	parsed, err := url.Parse(href)
	if err != nil {
		return false
	}
	return slices.Contains(linkSchemes, strings.ToLower(parsed.Scheme))
}

func refuse(format string, value string) error {
	return &ContentError{Reason: fmt.Sprintf(format, value)}
}
