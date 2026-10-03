package auth

import (
	"net/url"
	"regexp"
	"strings"
)

var schemePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.\-]*:`)

var returnToBase = &url.URL{Scheme: "http", Host: "localhost", Path: "/"}

func SafeReturnTo(raw string) string {
	cleaned := strings.TrimFunc(raw, func(r rune) bool { return r <= 0x20 })
	cleaned = strings.Map(func(r rune) rune {
		if r == '\t' || r == '\n' || r == '\r' {
			return -1
		}
		return r
	}, cleaned)
	if cleaned == "" || schemePattern.MatchString(cleaned) {
		return "/"
	}
	cleaned = normalizeSlashes(cleaned)
	if strings.HasPrefix(cleaned, "//") {
		return "/"
	}
	ref, err := url.Parse(cleaned)
	if err != nil || ref.Host != "" || ref.Scheme != "" {
		return "/"
	}
	resolved := returnToBase.ResolveReference(ref)
	if resolved.Host != returnToBase.Host {
		return "/"
	}
	path := resolved.EscapedPath()
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return "/"
	}
	if resolved.RawQuery != "" {
		path += "?" + escapeQuery(resolved.RawQuery)
	}
	return path
}

func WithQuery(path, key, value string) string {
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}
	return path + separator + key + "=" + url.QueryEscape(value)
}

func normalizeSlashes(raw string) string {
	end := strings.IndexAny(raw, "?#")
	if end < 0 {
		end = len(raw)
	}
	return strings.ReplaceAll(raw[:end], `\`, "/") + raw[end:]
}

func escapeQuery(raw string) string {
	var builder strings.Builder
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if c <= 0x20 || c >= 0x7f || c == '"' || c == '#' || c == '<' || c == '>' || c == '\'' {
			builder.WriteString("%")
			builder.WriteString(strings.ToUpper(hexByte(c)))
			continue
		}
		builder.WriteByte(c)
	}
	return builder.String()
}

func hexByte(c byte) string {
	const digits = "0123456789abcdef"
	return string([]byte{digits[c>>4], digits[c&0x0f]})
}
