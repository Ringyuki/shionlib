package inspection

import (
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

const unreadableRune = "�"

var legacyDecoders = map[Encoding]encoding.Encoding{
	EncodingShiftJIS: japanese.ShiftJIS,
	EncodingGBK:      simplifiedchinese.GBK,
	EncodingBig5:     traditionalchinese.Big5,
	EncodingEUCJP:    japanese.EUCJP,
}

func (e Encoding) Legacy() bool {
	_, legacy := legacyDecoders[e]
	return legacy
}

func Decode(raw []byte, from Encoding) (string, bool) {
	decoder, legacy := legacyDecoders[from]
	if !legacy {
		return "", false
	}
	decoded, err := decoder.NewDecoder().Bytes(raw)
	if err != nil {
		return "", false
	}
	return string(decoded), true
}

func ReadableText(raw string) string {
	return strings.ToValidUTF8(strings.ReplaceAll(raw, "\x00", ""), unreadableRune)
}

func ReadableNames(names []string, expected Encoding) ([]string, Encoding) {
	var sample []byte
	for _, name := range names {
		if !utf8.ValidString(name) && len(sample) < EncodingSampleBytes {
			sample = append(append(sample, name...), '\n')
		}
	}
	if len(sample) == 0 {
		return names, EncodingUnknown
	}
	detected := DetectEncodingExpecting(sample, expected)
	if !detected.Legacy() {
		detected = EncodingUnknown
	}
	out := make([]string, len(names))
	for i, name := range names {
		out[i] = name
		if utf8.ValidString(name) {
			continue
		}
		from := detected
		if !from.Legacy() {
			from = DetectEncodingExpecting([]byte(name), expected)
		}
		if decoded, ok := Decode([]byte(name), from); ok {
			out[i] = decoded
			continue
		}
		out[i] = ReadableText(name)
	}
	return out, detected
}
