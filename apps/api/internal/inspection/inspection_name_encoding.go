package inspection

import (
	_ "embed"
	"math"
	"strings"
	"unicode/utf8"
)

//go:embed name_characters.txt
var nameCharacters string

const nameRankOffset = 10

var nameCandidates = []struct {
	encoding Encoding
	prior    float64
}{
	{EncodingGBK, math.Log(0.9)},
	{EncodingShiftJIS, math.Log(0.08)},
	{EncodingBig5, math.Log(0.01)},
	{EncodingEUCJP, math.Log(0.01)},
}

var characterRanks = rankCharacters(nameCharacters)

var unknownCharacterCost = math.Log(float64(len(characterRanks) * 4))

func rankCharacters(ranked string) map[rune]int {
	ranks := make(map[rune]int)
	for _, char := range strings.TrimSuffix(ranked, "\n") {
		if _, seen := ranks[char]; !seen {
			ranks[char] = len(ranks)
		}
	}
	return ranks
}

func DetectNameEncoding(names []string, expected Encoding) Encoding {
	sample := sampleNames(names)
	if len(sample) == 0 {
		return EncodingUnknown
	}
	if allUTF8(sample) {
		return EncodingUTF8
	}
	if expected.Legacy() && decodesAll(sample, expected) {
		return expected
	}
	best, bestScore := EncodingUnknown, math.Inf(-1)
	for _, candidate := range nameCandidates {
		score, readable := namesScore(sample, candidate.encoding)
		if readable && candidate.prior+score > bestScore {
			best, bestScore = candidate.encoding, candidate.prior+score
		}
	}
	return best
}

func sampleNames(names []string) []string {
	size := 0
	for i, name := range names {
		if size += len(name); size > EncodingSampleBytes {
			return names[:max(i, 1)]
		}
	}
	return names
}

func allUTF8(names []string) bool {
	for _, name := range names {
		if !utf8.ValidString(name) {
			return false
		}
	}
	return true
}

func decodesAll(names []string, from Encoding) bool {
	for _, name := range names {
		if _, ok := decodeStrictly(name, from); !ok {
			return false
		}
	}
	return true
}

func namesScore(names []string, from Encoding) (float64, bool) {
	score, readable := 0.0, false
	for _, name := range names {
		decoded, ok := decodeStrictly(name, from)
		if !ok {
			score -= 2 * unknownCharacterCost * float64(wideBytes(name)/2+1)
			continue
		}
		readable = true
		for _, char := range decoded {
			score += characterWeight(char)
		}
	}
	return score, readable
}

func decodeStrictly(name string, from Encoding) (string, bool) {
	decoded, ok := Decode([]byte(name), from)
	if !ok || strings.ContainsFunc(decoded, unassigned) {
		return "", false
	}
	return decoded, true
}

func unassigned(char rune) bool {
	return char == utf8.RuneError || (char >= 0xE000 && char <= 0xF8FF)
}

func characterWeight(char rune) float64 {
	if char < utf8.RuneSelf {
		return 0
	}
	if rank, known := characterRanks[char]; known {
		return -math.Log(float64(rank + nameRankOffset))
	}
	return -unknownCharacterCost
}

func wideBytes(name string) int {
	count := 0
	for i := 0; i < len(name); i++ {
		if name[i] >= utf8.RuneSelf {
			count++
		}
	}
	return count
}
