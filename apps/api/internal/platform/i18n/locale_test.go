package i18n_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
)

func TestLocaleMatching(t *testing.T) {
	for tag, want := range map[string]i18n.Locale{"zh-CN": i18n.LocaleZH, " EN_us ": i18n.LocaleEN, "ja": i18n.LocaleJA} {
		if got, ok := i18n.Match(tag); !ok || got != want {
			t.Fatalf("%q: %q %v", tag, got, ok)
		}
	}
	if _, ok := i18n.Match("fr"); ok {
		t.Fatal("unsupported locales do not match")
	}
}

func TestAcceptLanguageHonoursWeights(t *testing.T) {
	if got, ok := i18n.MatchAcceptLanguage("fr;q=1, ja;q=0.5, en;q=0.8"); !ok || got != i18n.LocaleEN {
		t.Fatalf("weighted %q %v", got, ok)
	}
	if got, ok := i18n.MatchAcceptLanguage("ja, en"); !ok || got != i18n.LocaleJA {
		t.Fatalf("order breaks ties %q %v", got, ok)
	}
	if _, ok := i18n.MatchAcceptLanguage("fr, de"); ok {
		t.Fatal("nothing supported")
	}
}

func TestLocaleTravelsWithTheContext(t *testing.T) {
	if _, ok := i18n.FromContext(context.Background()); ok {
		t.Fatal("no locale by default")
	}
	if got, ok := i18n.FromContext(i18n.WithLocale(context.Background(), i18n.LocaleJA)); !ok || got != i18n.LocaleJA {
		t.Fatalf("round trip %q", got)
	}
}
