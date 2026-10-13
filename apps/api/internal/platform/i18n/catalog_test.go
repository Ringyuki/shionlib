package i18n_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/i18n"
)

func TestTranslationsFallBackAndInterpolate(t *testing.T) {
	catalog, err := i18n.Load(i18n.LocaleZH)
	if err != nil {
		t.Fatal(err)
	}
	if catalog.Fallback() != i18n.LocaleZH {
		t.Fatal("fallback locale")
	}
	for _, locale := range i18n.Supported() {
		if !catalog.Has(locale, "common.error") {
			t.Fatalf("%s misses common.error", locale)
		}
	}
	if got := catalog.T(i18n.LocaleZH, "validation.common.IS_NOT_EMPTY", map[string]any{"property": "name"}); got != "name 不能为空" {
		t.Fatalf("interpolated %q", got)
	}
	if got := catalog.T(i18n.LocaleZH, "validation.common.IS_NOT_EMPTY", nil); got != "{property} 不能为空" {
		t.Fatalf("missing args keep their placeholder %q", got)
	}
	if got := catalog.T(i18n.LocaleEN, "missing.key", nil); got != "missing.key" {
		t.Fatalf("unknown keys echo the key %q", got)
	}
}
