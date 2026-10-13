package translator_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

func TestCleanKeepsTheWritingAndTidiesSpaces(t *testing.T) {
	if got := translator.Clean("  Can／need   汉化组 "); got != "Can／need 汉化组" {
		t.Fatalf("clean %q", got)
	}
}

func TestKeyFoldsWidthCaseAndSpaces(t *testing.T) {
	for name, want := range map[string]string{
		"Can／Need汉化组": "can/need汉化组",
		" PRO2  汉化组 ": "pro2 汉化组",
		"ＡＵＧＵＳＴ":      "august",
	} {
		if got := translator.Key(name); got != want {
			t.Fatalf("key of %q: %q", name, got)
		}
	}
}

func TestLooseKeyIgnoresSuffixesVariantsAndPunctuation(t *testing.T) {
	same := [][]string{
		{"默示游戏中文化兴趣小组", "黙示游戏中文化兴趣小组"},
		{"破琵琶生产公社汉化组", "破琵琶生产公社"},
		{"Can/need汉化组", "Can/Need汉化组", "Can／need汉化组", "Can/need"},
		{"KID Fans Club汉化组", "kid fans club"},
		{"两个人汉化", "两个人汉化组"},
	}
	for _, group := range same {
		for _, name := range group[1:] {
			if translator.LooseKey(name) != translator.LooseKey(group[0]) {
				t.Fatalf("%q and %q should look alike: %q %q", group[0], name, translator.LooseKey(group[0]), translator.LooseKey(name))
			}
		}
	}
	if translator.LooseKey("绿茶汉化组") == translator.LooseKey("绿洲汉化组") {
		t.Fatal("different names stay apart")
	}
	if translator.LooseKey("汉化组") == "" {
		t.Fatal("a name that is only a suffix keeps its key")
	}
}
