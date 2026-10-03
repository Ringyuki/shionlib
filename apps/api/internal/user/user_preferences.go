package user

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

var languageRange = regexp.MustCompile(`^([A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})?)(?:\s*;\s*q\s*=\s*(1(?:\.0{0,3})?|0(?:\.\d{0,3})?))?$`)

func PreferredLang(acceptLanguage string) Lang {
	if strings.TrimSpace(acceptLanguage) == "" {
		return LangEN
	}
	type candidate struct {
		base  string
		q     float64
		index int
	}
	var candidates []candidate
	for index, item := range strings.Split(acceptLanguage, ",") {
		match := languageRange.FindStringSubmatch(strings.TrimSpace(item))
		if match == nil {
			continue
		}
		q := 1.0
		if match[2] != "" {
			parsed, err := strconv.ParseFloat(strings.TrimSuffix(match[2], "."), 64)
			if err == nil {
				q = min(max(parsed, 0), 1)
			}
		}
		base, _, _ := strings.Cut(strings.ToLower(match[1]), "-")
		candidates = append(candidates, candidate{base: base, q: q, index: index})
	}
	slices.SortStableFunc(candidates, func(a, b candidate) int {
		switch {
		case a.q > b.q:
			return -1
		case a.q < b.q:
			return 1
		default:
			return a.index - b.index
		}
	})
	for _, c := range candidates {
		if lang := Lang(c.base); lang.Valid() {
			return lang
		}
	}
	return LangEN
}

func MeetsPasswordPolicy(password string) bool {
	runes := []rune(password)
	start := 0
	for start <= len(runes) {
		end := start
		for end < len(runes) && !isLineTerminator(runes[end]) {
			end++
		}
		if lineMeetsPolicy(runes, start, end) {
			return true
		}
		start = end + 1
	}
	return false
}

func lineMeetsPolicy(runes []rune, start, end int) bool {
	first := start
	for first < end && runes[first] == '.' {
		first++
	}
	if first >= end {
		return false
	}
	var upper, lower, digitOrSymbol bool
	for _, r := range runes[first:end] {
		switch {
		case r >= 'A' && r <= 'Z':
			upper = true
		case r >= 'a' && r <= 'z':
			lower = true
		case r >= '0' && r <= '9', r != '_':
			digitOrSymbol = true
		}
	}
	if end < len(runes) {
		digitOrSymbol = true
	}
	return upper && lower && digitOrSymbol
}

func isLineTerminator(r rune) bool {
	return r == '\n' || r == '\r' || r == ' ' || r == ' '
}
