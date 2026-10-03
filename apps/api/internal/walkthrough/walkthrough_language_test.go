package walkthrough_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func TestDetectLanguage(t *testing.T) {
	cases := []struct {
		name    string
		title   string
		content string
		want    walkthrough.Language
	}{
		{"empty input", "", "  ", walkthrough.LanguageUnknown},
		{"chinese with a few kana stays chinese", "", "这是一个中文攻略，主要讲解路线选择和结局条件，里面夹杂角色名さくら和系统提示。请按照步骤操作。", walkthrough.LanguageChinese},
		{"substantial kana is japanese", "", "この攻略では、はじめに共通ルートを進めて、三日目の選択肢でヒロイン分岐に入ります。", walkthrough.LanguageJapanese},
		{"traditional only characters", "", "這篇攻略會說明遊戲流程與結局條件，請依照步驟選擇。", walkthrough.LanguageTraditionalChinese},
		{"title and content are combined", "Walkthrough", "Route guideChoose option A first", walkthrough.LanguageEnglish},
		{"short japanese with particles", "", "共通ルートで選択肢を選ぶ", walkthrough.LanguageJapanese},
		{"short chinese", "", "攻略", walkthrough.LanguageChinese},
		{"short latin is unknown", "", "Guide", walkthrough.LanguageUnknown},
		{"latin dominated mixed text", "", "Route A guide for 攻略", walkthrough.LanguageEnglish},
		{"long chinese with a japanese name", "", "这是一个中文攻略主要讲解路线选择和结局条件以及各个角色的好感度变化请按照步骤操作即可完成全部结局さくらさくら", walkthrough.LanguageChinese},
		{"other scripts", "", "Привет мир", walkthrough.LanguageUnknown},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := walkthrough.DetectLanguage(c.title, c.content); got != c.want {
				t.Fatalf("got %s, want %s", got, c.want)
			}
		})
	}
	if walkthrough.LanguageUnknown.Stored() != nil || *walkthrough.LanguageTraditionalChinese.Stored() != "zh-hant" {
		t.Fatal("unknown languages are stored as null")
	}
}
