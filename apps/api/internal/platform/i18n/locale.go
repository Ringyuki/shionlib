package i18n

import (
	"context"
	"slices"
	"strconv"
	"strings"
)

type Locale string

const (
	LocaleZH Locale = "zh"
	LocaleEN Locale = "en"
	LocaleJA Locale = "ja"
)

func Supported() []Locale {
	return []Locale{LocaleZH, LocaleEN, LocaleJA}
}

func (l Locale) Supported() bool {
	return slices.Contains(Supported(), l)
}

func Match(tag string) (Locale, bool) {
	tag = strings.ToLower(strings.TrimSpace(tag))
	if tag == "" {
		return "", false
	}
	base, _, _ := strings.Cut(tag, "-")
	base, _, _ = strings.Cut(base, "_")
	locale := Locale(base)
	if locale.Supported() {
		return locale, true
	}
	return "", false
}

func MatchAcceptLanguage(header string) (Locale, bool) {
	type candidate struct {
		locale Locale
		weight float64
		order  int
	}
	var candidates []candidate
	for index, part := range strings.Split(header, ",") {
		tag, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		locale, ok := Match(tag)
		if !ok {
			continue
		}
		weight := 1.0
		if q, found := strings.CutPrefix(strings.TrimSpace(params), "q="); found {
			weight = parseWeight(q)
		}
		if weight <= 0 {
			continue
		}
		candidates = append(candidates, candidate{locale: locale, weight: weight, order: index})
	}
	if len(candidates) == 0 {
		return "", false
	}
	slices.SortStableFunc(candidates, func(a, b candidate) int {
		switch {
		case a.weight > b.weight:
			return -1
		case a.weight < b.weight:
			return 1
		default:
			return a.order - b.order
		}
	})
	return candidates[0].locale, true
}

func parseWeight(raw string) float64 {
	weight, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0
	}
	return weight
}

type localeKey struct{}

func WithLocale(ctx context.Context, locale Locale) context.Context {
	return context.WithValue(ctx, localeKey{}, locale)
}

func FromContext(ctx context.Context) (Locale, bool) {
	locale, ok := ctx.Value(localeKey{}).(Locale)
	return locale, ok
}
