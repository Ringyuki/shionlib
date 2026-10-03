package walkthrough

import (
	"strings"
	"unicode"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

type Language string

const (
	LanguageEnglish            Language = "en"
	LanguageChinese            Language = "zh"
	LanguageTraditionalChinese Language = "zh-hant"
	LanguageJapanese           Language = "jp"
	LanguageUnknown            Language = "unknown"
)

func (l Language) Stored() *string {
	if l == LanguageUnknown || l == "" {
		return nil
	}
	value := string(l)
	return &value
}

func DetectLanguage(title, content string) Language {
	parts := make([]string, 0, 2)
	for _, part := range []string{title, content} {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	text := strings.Join(parts, "\n")
	if text == "" {
		return LanguageUnknown
	}
	counts := countScripts(text)
	kana := counts.kana()
	switch {
	case kana >= 8 && kana*3 >= counts.han:
		return LanguageJapanese
	case counts.han >= 8 && kana < 4:
		return chineseVariant(text)
	case counts.han == 0 && counts.latin >= 8:
		return LanguageEnglish
	case (counts.hiragana > 0 && counts.hiragana*5 >= counts.han) || (kana > 0 && kana >= counts.han):
		return LanguageJapanese
	case counts.latin > counts.han && counts.latin >= 8:
		return LanguageEnglish
	case counts.han > 0 && (counts.han >= counts.latin || counts.han >= 4):
		return chineseVariant(text)
	}
	return LanguageUnknown
}

type scripts struct {
	hiragana int
	katakana int
	han      int
	latin    int
}

func (s scripts) kana() int {
	return s.hiragana + s.katakana
}

func countScripts(text string) scripts {
	var counts scripts
	for _, r := range text {
		switch {
		case unicode.Is(unicode.Hiragana, r):
			counts.hiragana++
		case unicode.Is(unicode.Katakana, r):
			counts.katakana++
		case unicode.Is(unicode.Han, r):
			counts.han++
		case unicode.Is(unicode.Latin, r):
			counts.latin++
		}
	}
	return counts
}

type hanVariant int

const (
	hanShared hanVariant = iota
	hanSimplified
	hanTraditional
)

func chineseVariant(text string) Language {
	known := map[rune]hanVariant{}
	simplified, traditional := 0, 0
	for _, r := range text {
		if !unicode.Is(unicode.Han, r) {
			continue
		}
		variant, ok := known[r]
		if !ok {
			variant = classifyHan(r)
			known[r] = variant
		}
		switch variant {
		case hanSimplified:
			simplified++
		case hanTraditional:
			traditional++
		}
	}
	if traditional > simplified {
		return LanguageTraditionalChinese
	}
	return LanguageChinese
}

func classifyHan(r rune) hanVariant {
	inSimplified := encodable(simplifiedchinese.HZGB2312, r)
	inTraditional := encodable(traditionalchinese.Big5, r)
	switch {
	case inSimplified && !inTraditional:
		return hanSimplified
	case inTraditional && !inSimplified:
		return hanTraditional
	}
	return hanShared
}

func encodable(charset encoding.Encoding, r rune) bool {
	_, err := charset.NewEncoder().String(string(r))
	return err == nil
}
