package lexical

import (
	"encoding/json"
	"slices"
	"strconv"
	"strings"
)

var (
	textEscaper      = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")
	attributeEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")
	lineEndings      = strings.NewReplacer("\r\n", "\n", "\r", "\n")
)

const maxColumns = 1000

type scope struct {
	code      bool
	listDepth int
	parent    *node
}

type renderer struct {
	b strings.Builder
}

func (d Document) HTML() string {
	if d.root == nil {
		return ""
	}
	r := &renderer{}
	r.children(d.root, scope{parent: d.root})
	return r.b.String()
}

func (r *renderer) children(parent *node, s scope) {
	s.parent = parent
	for _, child := range parent.Children {
		r.node(child, s)
	}
}

func (r *renderer) node(n *node, s scope) {
	switch n.Type {
	case typeParagraph:
		r.block("p", classParagraph, n, s)
	case typeHeading:
		r.block(n.Tag, headingClasses[n.Tag], n, s)
	case typeQuote:
		r.block("blockquote", classQuote, n, s)
	case typeList:
		r.list(n, s)
	case typeListItem:
		r.listItem(n, s)
	case typeLink, typeAutoLink:
		r.link(n, s)
	case typeText, typeTab:
		r.text(n, s, "")
	case typeHashtag:
		r.text(n, s, classHashtag)
	case typeLineBreak:
		r.b.WriteString("<br />")
	case typeCode:
		r.code(n, s)
	case typeCodeHighlight:
		r.highlight(n, s)
	case typeHorizontalRule:
		r.b.WriteString("<hr />")
	case typeOverflow:
		r.children(n, s)
	case typeTable:
		r.table(n, s)
	case typeTableRow:
		r.open("tr", "", "")
		r.children(n, s)
		r.close("tr")
	case typeTableCell:
		r.cell(n, s)
	}
}

func (r *renderer) block(tag, class string, n *node, s scope) {
	r.open(tag, class, alignStyle(n.Format))
	if len(n.Children) == 0 {
		r.b.WriteString("<br />")
	} else {
		r.children(n, s)
	}
	r.close(tag)
}

func (r *renderer) list(n *node, s scope) {
	tag := "ul"
	if n.ListType == "number" {
		tag = "ol"
	}
	depthClasses := listDepthClasses[tag]
	checklist := ""
	if n.ListType == "check" {
		checklist = classCheckList
	}
	r.open(tag, joinClasses(listClasses[tag], checklist, depthClasses[s.listDepth%len(depthClasses)]), "")
	s.listDepth++
	r.children(n, s)
	r.close(tag)
}

func (r *renderer) listItem(n *node, s scope) {
	state := ""
	if s.parent != nil && s.parent.Type == typeList && s.parent.ListType == "check" {
		state = classListItemUnchecked
		if n.Checked != nil && *n.Checked {
			state = classListItemChecked
		}
	}
	nested := ""
	if slices.ContainsFunc(n.Children, func(child *node) bool { return child.Type == typeList }) {
		nested = classListItemNested
	}
	r.open("li", joinClasses(classListItem, state, nested), alignStyle(n.Format))
	r.children(n, s)
	r.close("li")
}

func (r *renderer) link(n *node, s scope) {
	if n.Type == typeAutoLink && n.IsUnlinked {
		r.open("span", "", "")
		r.children(n, s)
		r.close("span")
		return
	}
	r.b.WriteString(`<a class="`)
	r.b.WriteString(attributeEscaper.Replace(classLink))
	r.b.WriteByte('"')
	if href, ok := sanitizeURL(n.URL); ok {
		r.attribute("href", href)
	}
	if target, ok := sanitizeTarget(n.Target); ok {
		r.attribute("target", target)
	}
	r.b.WriteString(` rel="noopener noreferrer">`)
	r.children(n, s)
	r.close("a")
}

func (r *renderer) text(n *node, s scope, extraClass string) {
	format := textFormat(n.Format)
	wrappers := make([]string, 0, 4)
	for _, wrapper := range []struct {
		flag int
		tag  string
	}{{formatBold, "b"}, {formatItalic, "i"}, {formatStrikethrough, "s"}, {formatUnderline, "u"}} {
		if format&wrapper.flag != 0 {
			wrappers = append(wrappers, wrapper.tag)
		}
	}
	for _, tag := range slices.Backward(wrappers) {
		r.open(tag, "", "")
	}
	outer := outerTag(format)
	switch outer {
	case "":
	case "code":
		r.b.WriteString(`<code spellcheck="false">`)
	default:
		r.open(outer, "", "")
	}
	inner := innerTag(format)
	r.open(inner, joinClasses(textClasses(format), extraClass), sanitizeStyle(n.Style))
	r.content(n.text(), s.code || format&formatCode != 0)
	r.close(inner)
	if outer != "" {
		r.close(outer)
	}
	for _, tag := range wrappers {
		r.close(tag)
	}
}

func (r *renderer) highlight(n *node, s scope) {
	class := ""
	if n.HighlightType != nil {
		class = codeHighlightClasses[*n.HighlightType]
	}
	r.open("span", class, sanitizeStyle(n.Style))
	r.content(n.text(), s.code)
	r.close("span")
}

func (r *renderer) code(n *node, s scope) {
	language := codeLanguage(n.Language)
	r.b.WriteString(`<pre class="`)
	r.b.WriteString(classCode)
	r.b.WriteByte('"')
	r.attribute("data-language", language)
	r.attribute("data-highlight-language", language)
	r.attribute("data-gutter", gutter(n))
	r.b.WriteString(` spellcheck="false">`)
	s.code = true
	r.children(n, s)
	r.close("pre")
}

func (r *renderer) table(n *node, s scope) {
	r.open("table", classTable, "")
	r.b.WriteString("<colgroup>")
	r.b.WriteString(strings.Repeat("<col />", columnCount(n)))
	r.b.WriteString("</colgroup>")
	if len(n.Children) > 0 {
		r.b.WriteString("<tbody>")
		r.children(n, s)
		r.b.WriteString("</tbody>")
	}
	r.close("table")
}

func (r *renderer) cell(n *node, s scope) {
	tag, class := "td", classTableCell
	background, ok := sanitizeColor(n.BackgroundColor)
	if n.HeaderState != 0 {
		tag, class = "th", joinClasses(classTableCell, classTableCellHeader)
		if n.BackgroundColor == nil || strings.TrimSpace(*n.BackgroundColor) == "" {
			background, ok = defaultHeaderBackground, true
		}
	}
	style := ""
	if ok {
		style = "background-color:" + background
	}
	r.open(tag, class, style)
	r.children(n, s)
	r.close(tag)
}

func (r *renderer) open(tag, class, style string) {
	r.b.WriteByte('<')
	r.b.WriteString(tag)
	if class != "" {
		r.attribute("class", class)
	}
	if style != "" {
		r.attribute("style", style)
	}
	r.b.WriteByte('>')
}

func (r *renderer) close(tag string) {
	r.b.WriteString("</")
	r.b.WriteString(tag)
	r.b.WriteByte('>')
}

func (r *renderer) attribute(name, value string) {
	r.b.WriteByte(' ')
	r.b.WriteString(name)
	r.b.WriteString(`="`)
	r.b.WriteString(attributeEscaper.Replace(value))
	r.b.WriteByte('"')
}

func (r *renderer) content(text string, preformatted bool) {
	escaped := textEscaper.Replace(lineEndings.Replace(text))
	if !preformatted {
		escaped = strings.ReplaceAll(escaped, "\n", "<br />")
	}
	r.b.WriteString(escaped)
}

func (n *node) text() string {
	if n.Text == nil {
		return ""
	}
	return *n.Text
}

func textFormat(raw json.RawMessage) int {
	var format int
	if err := json.Unmarshal(raw, &format); err != nil {
		return 0
	}
	return format
}

func alignStyle(raw json.RawMessage) string {
	var named string
	if err := json.Unmarshal(raw, &named); err != nil {
		named = numericAligns[strings.TrimSpace(string(raw))]
	}
	if !slices.Contains(elementAligns, named) {
		return ""
	}
	return "text-align:" + named
}

func textClasses(format int) string {
	underlineStrikethrough := format&formatUnderline != 0 && format&formatStrikethrough != 0
	groups := make([]string, 0, len(textFormatClasses)+1)
	if underlineStrikethrough {
		groups = append(groups, classUnderlineStrikethrough)
	}
	for _, entry := range textFormatClasses {
		if format&entry.flag == 0 {
			continue
		}
		if underlineStrikethrough && (entry.flag == formatUnderline || entry.flag == formatStrikethrough) {
			continue
		}
		groups = append(groups, entry.class)
	}
	return joinClasses(groups...)
}

func outerTag(format int) string {
	switch {
	case format&formatCode != 0:
		return "code"
	case format&formatHighlight != 0:
		return "mark"
	case format&formatSubscript != 0:
		return "sub"
	case format&formatSuperscript != 0:
		return "sup"
	}
	return ""
}

func innerTag(format int) string {
	switch {
	case format&formatBold != 0:
		return "strong"
	case format&formatItalic != 0:
		return "em"
	}
	return "span"
}

func joinClasses(groups ...string) string {
	var tokens []string
	for _, group := range groups {
		for token := range strings.FieldsSeq(group) {
			if !slices.Contains(tokens, token) {
				tokens = append(tokens, token)
			}
		}
	}
	return strings.Join(tokens, " ")
}

func gutter(code *node) string {
	lines := countLineBreaks(code) + 1
	if lines <= 1 {
		var b strings.Builder
		code.writeText(&b)
		lines = strings.Count(lineEndings.Replace(b.String()), "\n") + 1
	}
	numbers := make([]string, lines)
	for i := range numbers {
		numbers[i] = strconv.Itoa(i + 1)
	}
	return strings.Join(numbers, "\n")
}

func countLineBreaks(n *node) int {
	count := 0
	for _, child := range n.Children {
		if child.Type == typeLineBreak {
			count++
		}
		count += countLineBreaks(child)
	}
	return count
}

func columnCount(table *node) int {
	if len(table.Children) == 0 {
		return 0
	}
	columns := 0
	for _, cell := range table.Children[0].Children {
		if cell.Type != typeTableCell {
			continue
		}
		span := 1
		if cell.ColSpan != nil && *cell.ColSpan > 1 {
			span = min(*cell.ColSpan, maxColumns)
		}
		columns = min(columns+span, maxColumns)
	}
	return columns
}
