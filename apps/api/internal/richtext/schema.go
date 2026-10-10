package richtext

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	nodeDocument  = "doc"
	nodeParagraph = "paragraph"
	nodeHardBreak = "hard_break"
	nodeText      = "text"
)

const (
	markBold    = "bold"
	markLink    = "link"
	markSpoiler = "spoiler"
)

const MaxLinkLength = 2000

var linkSchemes = []string{"http", "https", "mailto"}

type contentRule int

const (
	noContent contentRule = iota
	inlineContent
	blockContent
)

type nodeSpec struct {
	block   bool
	inline  bool
	content contentRule
}

var specs = map[string]nodeSpec{
	nodeDocument:  {content: blockContent},
	nodeParagraph: {block: true, content: inlineContent},
	nodeHardBreak: {inline: true},
	nodeText:      {inline: true},
}

var nodeTypes = []string{nodeParagraph, nodeHardBreak, nodeText}

var markTypes = []string{markBold, markLink, markSpoiler}

type Schema struct {
	nodes []string
	marks []string
}

var Comment = Schema{nodes: nodeTypes, marks: markTypes}

func NodeTypes() []string {
	return slices.Clone(nodeTypes)
}

func MarkTypes() []string {
	return slices.Clone(markTypes)
}

func (s Schema) check(n *node) error {
	if n == nil {
		return ErrNotDocument
	}
	spec, known := specs[n.Type]
	if !known || (n.Type != nodeDocument && !slices.Contains(s.nodes, n.Type)) {
		return refuse("content contains an unsupported node type %q", n.Type)
	}
	if err := s.checkOwn(n, spec); err != nil {
		return err
	}
	if err := checkChildren(n, spec.content); err != nil {
		return err
	}
	for _, child := range n.Content {
		if err := s.check(child); err != nil {
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
	for _, child := range n.Content {
		if child == nil {
			return ErrNotDocument
		}
		if _, known := specs[child.Type]; !known {
			return refuse("content contains an unsupported node type %q", child.Type)
		}
		if !fits(rule, child.Type) {
			return refuse("a %q node cannot be placed there", child.Type)
		}
	}
	return nil
}

func fits(rule contentRule, child string) bool {
	spec := specs[child]
	switch rule {
	case inlineContent:
		return spec.inline
	case blockContent:
		return spec.block
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
