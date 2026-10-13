package translator

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var groupSuffixes = []string{"汉化组", "汉化小组", "汉化", "中文化小组", "中文化委员会", "个人汉化", "字幕组"}

var characterVariants = strings.NewReplacer(
	"黙", "默", "漢", "汉", "組", "组", "學", "学", "園", "园", "會", "会", "員", "员", "遊", "游", "戲", "戏", "戯", "戏",
	"興", "兴", "個", "个", "譯", "译", "訳", "译", "屆", "届", "愛", "爱", "護", "护", "協", "协", "風", "风", "櫻", "樱",
	"桜", "樱", "夢", "梦", "戀", "恋", "鄉", "乡", "綠", "绿", "緑", "绿", "臉", "脸", "腫", "肿", "願", "愿", "聖", "圣",
	"龍", "龙", "竜", "龙", "貓", "猫", "機", "机", "體", "体", "団", "团", "團", "团", "隊", "队",
)

func Clean(name string) string {
	return strings.Join(strings.Fields(norm.NFC.String(name)), " ")
}

func Key(name string) string {
	return strings.ToLower(strings.Join(strings.Fields(norm.NFKC.String(name)), " "))
}

func LooseKey(name string) string {
	key := characterVariants.Replace(Key(name))
	key = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r) {
			return -1
		}
		return r
	}, key)
	for _, suffix := range groupSuffixes {
		if trimmed := strings.TrimSuffix(key, suffix); trimmed != key && trimmed != "" {
			return trimmed
		}
	}
	return key
}

func uniqueByKey(names []string, exclude ...string) []string {
	seen := map[string]bool{}
	for _, name := range exclude {
		seen[Key(name)] = true
	}
	out := make([]string, 0, len(names))
	for _, name := range names {
		cleaned := Clean(name)
		key := Key(cleaned)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, cleaned)
	}
	return out
}

func keysOf(names []string) []string {
	keys := make([]string, len(names))
	for i, name := range names {
		keys[i] = Key(name)
	}
	return keys
}
