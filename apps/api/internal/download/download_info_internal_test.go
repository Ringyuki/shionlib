package download

import (
	"slices"
	"strings"
	"testing"
)

func pointer[T any](v T) *T {
	return &v
}

func TestTranslatedMeansALanguageOtherThanJapanese(t *testing.T) {
	if Translated([]string{"jp"}) || Translated(nil) {
		t.Fatal("Japanese alone is the original")
	}
	if !Translated([]string{"jp", "zh-hant"}) || !Translated([]string{"en"}) {
		t.Fatal("any other language is a translation")
	}
}

func TestSettledKeepsWhatTheTranslationAllows(t *testing.T) {
	official, err := InfoInput{Translation: pointer(TranslationOfficial), Translators: []string{"绿茶汉化组"}, PatchVersion: pointer("v1"), ReleaseURL: pointer("https://example.org"), Form: pointer(FormPortable)}.settled([]string{"zh", "jp"}, true)
	if err != nil || *official.Translation != TranslationOfficial || len(official.Translators) != 0 || official.PatchVersion != nil || official.ReleaseURL != nil {
		t.Fatalf("an official translation credits nobody and has no patch: %+v %v", official, err)
	}
	machine, err := InfoInput{Translation: pointer(TranslationMachine), Translators: []string{"绿茶汉化组"}, PatchVersion: pointer("v2.8"), ReleaseURL: pointer("http://example.org/p"), Form: pointer(FormPortable)}.settled([]string{"zh"}, true)
	if err != nil || len(machine.Translators) != 0 || *machine.PatchVersion != "v2.8" || *machine.ReleaseURL != "http://example.org/p" {
		t.Fatalf("a machine translation keeps its version and page: %+v %v", machine, err)
	}
	none, err := InfoInput{Translation: pointer(TranslationNone), Form: pointer(FormDisc)}.settled([]string{"zh"}, true)
	if err != nil || *none.Translation != TranslationNone {
		t.Fatalf("a game written in Chinese is not a translation: %+v %v", none, err)
	}
	unknown, err := InfoInput{}.settled([]string{"zh"}, false)
	if err != nil || unknown.Translation != nil || unknown.Form != nil || unknown.Extras == nil {
		t.Fatalf("an edit may leave translation and form unknown: %+v %v", unknown, err)
	}
}

func TestSettledChecksLengthsAndAddresses(t *testing.T) {
	group := func(change func(*InfoInput)) error {
		in := InfoInput{Translation: pointer(TranslationGroup), Translators: []string{"绿茶汉化组"}, Form: pointer(FormPortable)}
		change(&in)
		_, err := in.settled([]string{"zh"}, true)
		return err
	}
	if err := group(func(in *InfoInput) { in.PatchVersion = pointer(strings.Repeat("版", MaxPatchVersionLength)) }); err != nil {
		t.Fatalf("the longest version: %v", err)
	}
	for name, change := range map[string]func(*InfoInput){
		"a long version":         func(in *InfoInput) { in.PatchVersion = pointer(strings.Repeat("版", MaxPatchVersionLength+1)) },
		"a long edition name":    func(in *InfoInput) { in.EditionName = pointer(strings.Repeat("版", MaxEditionNameLength+1)) },
		"an address with space":  func(in *InfoInput) { in.ReleaseURL = pointer("https://example.org/a b") },
		"a bare scheme":          func(in *InfoInput) { in.ReleaseURL = pointer("https://") },
		"an unknown edition":     func(in *InfoInput) { in.Edition = pointer(Edition("floppy")) },
		"an unknown translation": func(in *InfoInput) { in.Translation = pointer(Translation("fan")) },
	} {
		if err := group(change); err == nil {
			t.Fatalf("%s is refused", name)
		}
	}
	extras, err := InfoInput{Form: pointer(FormPortable), Extras: []string{"bonus", "bonus", "x", "save"}}.settled([]string{"jp"}, true)
	if err != nil || !slices.Equal(extras.Extras, []string{"save", "bonus"}) {
		t.Fatalf("extras keep the known values once, in a fixed order: %+v %v", extras, err)
	}
}
