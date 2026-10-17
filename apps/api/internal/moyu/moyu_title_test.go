package moyu_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestTitleKey(t *testing.T) {
	for title, want := range map[string]string{
		"D.C.White Season ～ダ・カーポ ホワイトシーズン～": "dcwhiteseasonダカーポホワイトシーズン",
		"Ｄ．Ｃ． White Season〜ダ・カーポ　ホワイトシーズン〜": "dcwhiteseasonダカーポホワイトシーズン",
		"あまえて☆にぃに３～にぃに♪":                    "あまえてにぃに3にぃに",
		"\ufeff妹!せいかつ 〜ファンタジー〜\u200b":       "妹せいかつファンタジー",
	} {
		if got := moyu.TitleKey(title); got != want {
			t.Fatalf("%q: got %q, want %q", title, got, want)
		}
	}
}

func TestAGameNamesAWorkOfTheSameTitleReleasedAroundTheSameTime(t *testing.T) {
	year := func(y int) *time.Time {
		date := time.Date(y, 6, 1, 0, 0, 0, 0, time.UTC)
		return &date
	}
	game := moyu.Game{Titles: []string{"魔法少女りな", "Magical Girl Rina"}, Released: year(1992)}
	for _, c := range []struct {
		name  string
		work  moyu.Work
		names bool
	}{
		{"same title", moyu.Work{Titles: []string{"魔法少女りな"}, Released: year(1993)}, true},
		{"one of its titles", moyu.Work{Titles: []string{"魔法少女リナ", "magical girl rina"}}, true},
		{"years apart", moyu.Work{Titles: []string{"魔法少女りな"}, Released: year(1995)}, false},
		{"a title that only begins the same", moyu.Work{Titles: []string{"魔法少女りな2"}}, false},
		{"no titles", moyu.Work{}, false},
	} {
		if got := game.Names(c.work); got != c.names {
			t.Fatalf("%s: got %v", c.name, got)
		}
	}
	if (moyu.Game{Titles: []string{"脅"}}).Names(moyu.Work{Titles: []string{"脅"}}) {
		t.Fatal("a title of one character names nothing")
	}
}

func TestTheTitleAGameIsSearchedBy(t *testing.T) {
	for _, c := range []struct {
		titles []string
		want   string
	}{
		{[]string{" プレミアムアーカイブス むとうけいじ ", "高级典藏"}, "プレミアムアーカイブス むとうけいじ"},
		{[]string{"", "!", "脅迫"}, "脅迫"},
		{[]string{"♪"}, ""},
		{nil, ""},
	} {
		if got := (moyu.Game{Titles: c.titles}).SearchTitle(); got != c.want {
			t.Fatalf("%v: got %q, want %q", c.titles, got, c.want)
		}
	}
}
