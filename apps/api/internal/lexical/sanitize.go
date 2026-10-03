package lexical

import (
	"regexp"
	"slices"
	"strings"
)

var colorValues = []*regexp.Regexp{
	regexp.MustCompile(`^#[0-9a-fA-F]{3,8}$`),
	regexp.MustCompile(`(?i)^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$`),
	regexp.MustCompile(`(?i)^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$`),
}

var allowedStyles = map[string][]*regexp.Regexp{
	"color":            colorValues,
	"background-color": colorValues,
	"text-align":       {regexp.MustCompile(`^(left|right|center|justify)$`)},
	"font-size":        {regexp.MustCompile(`^(?:[1-9]|[12]\d|30)px$`)},
}

var (
	schemePattern   = regexp.MustCompile(`^([a-zA-Z][a-zA-Z0-9.+-]*):`)
	languagePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_+#.-]{0,39}$`)
)

var (
	allowedSchemes = []string{"http", "https", "mailto", "tel"}
	allowedTargets = []string{"_blank", "_self", "_parent", "_top"}
	elementAligns  = []string{"left", "center", "right", "justify"}
	numericAligns  = map[string]string{"1": "left", "2": "center", "3": "right", "4": "justify"}
)

const importantSuffix = "!important"

func sanitizeStyle(css string) string {
	var order []string
	values := map[string]string{}
	for declaration := range strings.SplitSeq(css, ";") {
		property, value, ok := strings.Cut(declaration, ":")
		if !ok {
			continue
		}
		property, value = strings.TrimSpace(property), strings.TrimSpace(value)
		if property == "" || value == "" {
			continue
		}
		if _, seen := values[property]; !seen {
			order = append(order, property)
		}
		values[property] = value
	}
	kept := make([]string, 0, len(order))
	for _, property := range order {
		value, important := values[property], ""
		if base, found := strings.CutSuffix(value, importantSuffix); found {
			value, important = strings.TrimSpace(base), " "+importantSuffix
		}
		if styleAllowed(property, value) {
			kept = append(kept, property+":"+value+important)
		}
	}
	return strings.Join(kept, ";")
}

func styleAllowed(property, value string) bool {
	patterns, ok := allowedStyles[property]
	if !ok {
		return false
	}
	return slices.ContainsFunc(patterns, func(pattern *regexp.Regexp) bool { return pattern.MatchString(value) })
}

func sanitizeColor(value *string) (string, bool) {
	if value == nil {
		return "", false
	}
	color := strings.TrimSpace(*value)
	if !styleAllowed("background-color", color) {
		return "", false
	}
	return color, true
}

func sanitizeURL(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", false
	}
	if strings.ContainsFunc(value, func(r rune) bool { return r < 0x20 || r == 0x7f }) {
		return "", false
	}
	compact := strings.Map(func(r rune) rune {
		if r <= 0x20 {
			return -1
		}
		return r
	}, value)
	if match := schemePattern.FindStringSubmatch(compact); match != nil && !slices.Contains(allowedSchemes, strings.ToLower(match[1])) {
		return "", false
	}
	return value, true
}

func sanitizeTarget(target *string) (string, bool) {
	if target == nil || !slices.Contains(allowedTargets, *target) {
		return "", false
	}
	return *target, true
}

func codeLanguage(language *string) string {
	if language == nil {
		return "plaintext"
	}
	value := strings.ToLower(strings.TrimSpace(*language))
	if !languagePattern.MatchString(value) {
		return "plaintext"
	}
	return value
}
