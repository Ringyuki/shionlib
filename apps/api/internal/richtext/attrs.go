package richtext

import (
	"slices"
	"unicode/utf8"
)

func (a *nodeAttrs) ofHeading() bool {
	return a.Level != 0
}

func (a *nodeAttrs) ofImage() bool {
	return a.Src != "" || a.Alt != "" || a.Caption != "" || a.Width != 0 || a.Height != 0 || a.WidthPercent != 0
}

func (a *nodeAttrs) ofCell() bool {
	return a.Colspan != 0 || a.Rowspan != 0 || a.Colwidth != nil || a.Align != ""
}

func checkAttrs(n *node) error {
	attrs := n.Attrs
	if attrs == nil {
		attrs = &nodeAttrs{}
	}
	switch n.Type {
	case nodeHeading:
		if attrs.ofImage() || attrs.ofCell() {
			return refuse("a %q node carries attributes of another node", n.Type)
		}
		if !slices.Contains(HeadingLevels, attrs.Level) {
			return &ContentError{Reason: "content contains an unsupported heading level"}
		}
	case nodeImage:
		if attrs.ofHeading() || attrs.ofCell() {
			return refuse("a %q node carries attributes of another node", n.Type)
		}
		return checkImage(attrs)
	case nodeTableHeader, nodeTableCell:
		if attrs.ofHeading() || attrs.ofImage() {
			return refuse("a %q node carries attributes of another node", n.Type)
		}
		return checkCell(attrs)
	default:
		if attrs.ofHeading() || attrs.ofImage() || attrs.ofCell() {
			return refuse("a %q node takes no attributes", n.Type)
		}
		n.Attrs = nil
	}
	return nil
}

func checkImage(attrs *nodeAttrs) error {
	if !IsImageKey(attrs.Src) {
		return &ContentError{Reason: "content contains an image that was not uploaded here"}
	}
	if attrs.Width < 1 || attrs.Width > MaxImageSide || attrs.Height < 1 || attrs.Height > MaxImageSide {
		return &ContentError{Reason: "content contains an image without a valid size"}
	}
	if attrs.WidthPercent != 0 && (attrs.WidthPercent < MinImageWidthPercent || attrs.WidthPercent > MaxImageWidthPercent) {
		return &ContentError{Reason: "content contains an image with an invalid display width"}
	}
	if utf8.RuneCountInString(attrs.Alt) > MaxAltLength || utf8.RuneCountInString(attrs.Caption) > MaxCaptionLength {
		return &ContentError{Reason: "content contains an image whose description is too long"}
	}
	return nil
}

func checkCell(attrs *nodeAttrs) error {
	if attrs.Colspan < 1 || attrs.Colspan > MaxCellSpan || attrs.Rowspan < 1 || attrs.Rowspan > MaxCellSpan {
		return &ContentError{Reason: "content contains a table cell with an invalid span"}
	}
	if attrs.Colwidth != nil && len(attrs.Colwidth) != attrs.Colspan {
		return &ContentError{Reason: "content contains a table cell whose widths do not match its span"}
	}
	if attrs.Align != "" && !slices.Contains(CellAlignments, attrs.Align) {
		return &ContentError{Reason: "content contains a table cell with an invalid alignment"}
	}
	for _, width := range attrs.Colwidth {
		if width < 0 || width > MaxColumnWidth {
			return &ContentError{Reason: "content contains a table cell with an invalid width"}
		}
	}
	return nil
}
