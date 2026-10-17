package moyu

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	shortestTitleKey  = 2
	releaseYearsApart = 1
)

func TitleKey(title string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r) || unicode.Is(unicode.Cf, r) {
			return -1
		}
		return unicode.ToLower(r)
	}, norm.NFKC.String(title))
}

func (g Game) SearchTitle() string {
	for _, title := range g.Titles {
		if utf8.RuneCountInString(TitleKey(title)) >= shortestTitleKey {
			return strings.TrimSpace(title)
		}
	}
	return ""
}

func (g Game) Names(work Work) bool {
	if g.Released != nil && work.Released != nil {
		apart := g.Released.Year() - work.Released.Year()
		if apart > releaseYearsApart || apart < -releaseYearsApart {
			return false
		}
	}
	ours := map[string]bool{}
	for _, title := range g.Titles {
		if key := TitleKey(title); utf8.RuneCountInString(key) >= shortestTitleKey {
			ours[key] = true
		}
	}
	for _, title := range work.Titles {
		if ours[TitleKey(title)] {
			return true
		}
	}
	return false
}
