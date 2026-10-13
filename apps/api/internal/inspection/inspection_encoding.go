package inspection

import (
	"bytes"
	"unicode/utf8"
)

type Encoding string

const (
	EncodingUnknown  Encoding = ""
	EncodingUTF8     Encoding = "utf-8"
	EncodingUTF16LE  Encoding = "utf-16le"
	EncodingUTF16BE  Encoding = "utf-16be"
	EncodingShiftJIS Encoding = "shift_jis"
	EncodingGBK      Encoding = "gbk"
	EncodingBig5     Encoding = "big5"
	EncodingEUCJP    Encoding = "euc-jp"
)

const EncodingSampleBytes = 64 << 10

var legacyEncodings = []struct {
	encoding Encoding
	score    func(data []byte) (int, bool)
}{
	{EncodingShiftJIS, scoreShiftJIS},
	{EncodingGBK, scoreGBK},
	{EncodingBig5, scoreBig5},
	{EncodingEUCJP, scoreEUCJP},
}

func unicodeMark(data []byte) (Encoding, bool) {
	switch {
	case bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}):
		return EncodingUTF8, true
	case bytes.HasPrefix(data, []byte{0xFF, 0xFE}):
		return EncodingUTF16LE, true
	case bytes.HasPrefix(data, []byte{0xFE, 0xFF}):
		return EncodingUTF16BE, true
	default:
		return EncodingUnknown, false
	}
}

func DetectEncoding(sample []byte) Encoding {
	if marked, found := unicodeMark(sample); found {
		return marked
	}
	if len(sample) > EncodingSampleBytes {
		sample = sample[:EncodingSampleBytes]
	}
	if validUTF8(sample) {
		return EncodingUTF8
	}
	best, bestScore := EncodingUnknown, 0
	for _, candidate := range legacyEncodings {
		score, valid := candidate.score(sample)
		if valid && score > bestScore {
			best, bestScore = candidate.encoding, score
		}
	}
	return best
}

func DetectEncodingExpecting(sample []byte, expected Encoding) Encoding {
	detected := DetectEncoding(sample)
	if detected == EncodingUTF8 || detected == EncodingUTF16LE || detected == EncodingUTF16BE {
		return detected
	}
	if len(sample) > EncodingSampleBytes {
		sample = sample[:EncodingSampleBytes]
	}
	for _, candidate := range legacyEncodings {
		if candidate.encoding != expected {
			continue
		}
		if _, valid := candidate.score(sample); valid {
			return expected
		}
	}
	return detected
}

func validUTF8(data []byte) bool {
	for cut := 0; cut < utf8.UTFMax && cut <= len(data); cut++ {
		if utf8.Valid(data[:len(data)-cut]) {
			return true
		}
	}
	return false
}

func within(value, low, high byte) bool {
	return value >= low && value <= high
}

func scoreShiftJIS(data []byte) (int, bool) {
	score := 0
	for i := 0; i < len(data); i++ {
		lead := data[i]
		switch {
		case lead < 0x80:
			continue
		case within(lead, 0xA1, 0xDF):
			score -= 2
			continue
		case !within(lead, 0x81, 0x9F) && !within(lead, 0xE0, 0xFC):
			return 0, false
		}
		if i+1 >= len(data) {
			break
		}
		i++
		trail := data[i]
		if !within(trail, 0x40, 0x7E) && !within(trail, 0x80, 0xFC) {
			return 0, false
		}
		switch {
		case lead == 0x82 && within(trail, 0x9F, 0xF1), lead == 0x83 && within(trail, 0x40, 0x96):
			score += 3
		case lead == 0x81:
			score += 2
		case within(lead, 0x88, 0x9F), within(lead, 0xE0, 0xEA):
			score++
		}
	}
	return score, true
}

func scoreGBK(data []byte) (int, bool) {
	score := 0
	for i := 0; i < len(data); i++ {
		lead := data[i]
		switch {
		case lead < 0x80:
			continue
		case !within(lead, 0x81, 0xFE):
			return 0, false
		}
		if i+1 >= len(data) {
			break
		}
		i++
		trail := data[i]
		if !within(trail, 0x40, 0xFE) || trail == 0x7F {
			return 0, false
		}
		switch {
		case trail < 0xA1, lead < 0xA1:
			score--
		case within(lead, 0xB0, 0xD7):
			score += 2
		case within(lead, 0xD8, 0xF7), within(lead, 0xA1, 0xA9):
			score++
		default:
			score--
		}
	}
	return score, true
}

func scoreBig5(data []byte) (int, bool) {
	score := 0
	for i := 0; i < len(data); i++ {
		lead := data[i]
		switch {
		case lead < 0x80:
			continue
		case !within(lead, 0xA1, 0xF9):
			return 0, false
		}
		if i+1 >= len(data) {
			break
		}
		i++
		trail := data[i]
		if !within(trail, 0x40, 0x7E) && !within(trail, 0xA1, 0xFE) {
			return 0, false
		}
		switch {
		case within(lead, 0xA4, 0xC6):
			score += 2
		case within(lead, 0xC9, 0xF9), within(lead, 0xA1, 0xA3):
			score++
		default:
			score--
		}
	}
	if score > 0 {
		score--
	}
	return score, true
}

func scoreEUCJP(data []byte) (int, bool) {
	score := 0
	for i := 0; i < len(data); i++ {
		lead := data[i]
		if lead < 0x80 {
			continue
		}
		width := 2
		switch {
		case lead == 0x8F:
			width = 3
		case lead != 0x8E && !within(lead, 0xA1, 0xFE):
			return 0, false
		}
		if i+width > len(data) {
			break
		}
		for _, trail := range data[i+1 : i+width] {
			if !within(trail, 0xA1, 0xFE) {
				return 0, false
			}
		}
		switch {
		case lead == 0x8E:
			score -= 2
		case lead == 0xA4, lead == 0xA5:
			score += 3
		case lead == 0xA1:
			score += 2
		case within(lead, 0xB0, 0xF4):
			score++
		}
		i += width - 1
	}
	return score, true
}
