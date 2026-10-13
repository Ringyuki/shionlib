package download_test

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

func limelight() download.NameSource {
	released := time.Date(2025, 9, 26, 0, 0, 0, 0, time.UTC)
	return download.NameSource{Released: &released, Brand: "ゆずソフト", Title: "ライムライト・レモネードジャム", Translated: "橘光柠水随想曲"}
}

func TestCanonicalNameWritesEverySegmentThatHasContent(t *testing.T) {
	credited := []translator.Ref{{ID: 1, Name: "Can/need汉化组"}, {ID: 2, Name: "破琵琶生产公社汉化组"}}
	for name, tc := range map[string]struct {
		in   download.NameInput
		want string
	}{
		"an original as a download edition": {
			download.NameInput{Source: limelight(), Languages: []string{"jp"}, Info: download.Info{Translation: ptr(download.TranslationNone), Edition: ptr(download.EditionDownload), Form: ptr(download.FormPortable)}, Uploaded: "LLLJ.7z"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム DL版 (files).7z",
		},
		"a translation by two groups with its patch version": {
			download.NameInput{Source: limelight(), Languages: []string{"zh"}, Info: download.Info{Translation: ptr(download.TranslationGroup), Translators: credited, PatchVersion: ptr("v1.1"), Form: ptr(download.FormPortable)}, Uploaded: "llj_chs.7z"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム 橘光柠水随想曲 [Can／need汉化组×破琵琶生产公社汉化组][v1.1] (files).7z",
		},
		"an official translation of a package edition with its name": {
			download.NameInput{Source: limelight(), Languages: []string{"zh-hant", "jp"}, Info: download.Info{Translation: ptr(download.TranslationOfficial), Edition: ptr(download.EditionPackage), EditionName: ptr(" 初回限定版 "), Form: ptr(download.FormInstaller)}, Uploaded: "a.rar"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム 橘光柠水随想曲 パッケージ版 初回限定版 [官方中文] (files).rar",
		},
		"an official English edition from Steam": {
			download.NameInput{Source: limelight(), Languages: []string{"en"}, Info: download.Info{Translation: ptr(download.TranslationOfficial), Edition: ptr(download.EditionSteam), Form: ptr(download.FormPortable)}, Uploaded: "a.zip"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム Steam版 [官方英文] (files).zip",
		},
		"a machine translation": {
			download.NameInput{Source: limelight(), Languages: []string{"zh"}, Info: download.Info{Translation: ptr(download.TranslationMachine), PatchVersion: ptr("v2.8"), Form: ptr(download.FormPortable)}, Uploaded: "a.zip"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム 橘光柠水随想曲 [机器翻译][v2.8] (files).zip",
		},
		"a disc image whose format is known": {
			download.NameInput{Source: limelight(), Languages: []string{"jp"}, Info: download.Info{Form: ptr(download.FormDisc)}, Medium: "iso+mds+rr3", Uploaded: "disc.part2.rar"},
			"[250926][ゆずソフト] ライムライト・レモネードジャム (iso+mds+rr3).part2.rar",
		},
		"nothing but a title": {
			download.NameInput{Source: download.NameSource{Title: "your diary"}, Languages: []string{"zh"}, Uploaded: "noext"},
			"your diary",
		},
	} {
		got := download.CanonicalName(tc.in)
		if got.Pending || got.String() != tc.want {
			t.Errorf("%s: %q, want %q", name, got.String(), tc.want)
		}
	}
}

func TestCanonicalNameWaitsForTheFormatOfADiscImage(t *testing.T) {
	for _, medium := range []string{"", "files", "files+rr3"} {
		got := download.CanonicalName(download.NameInput{Source: limelight(), Languages: []string{"jp"}, Info: download.Info{Form: ptr(download.FormDisc)}, Medium: medium, Uploaded: "disc.7z"})
		if !got.Pending || got.Before != "[250926][ゆずソフト] ライムライト・レモネードジャム (" || got.After != ").7z" {
			t.Fatalf("pending name with the medium %q: %+v", medium, got)
		}
	}
}

func TestCanonicalNameReplacesWhatAFileNameCannotHold(t *testing.T) {
	source := download.NameSource{Brand: `A/B:C`, Title: "Who? <Me> | \"You\" *\\\n next\tline "}
	got := download.CanonicalName(download.NameInput{Source: source, Languages: []string{"jp"}, Uploaded: "a.7z"})
	if got.String() != "[A／B：C] Who？ ＜Me＞ ｜ ＂You＂ ＊＼ next line.7z" {
		t.Fatalf("sanitized name %q", got.String())
	}
}

func TestCanonicalNameStaysWithinTheLengthOfAFileName(t *testing.T) {
	source := limelight()
	source.Title = strings.Repeat("長", 300)
	got := download.CanonicalName(download.NameInput{Source: source, Languages: []string{"zh"}, Info: download.Info{Form: ptr(download.FormPortable)}, Uploaded: "a.7z"})
	if utf8.RuneCountInString(got.String()) != download.MaxFileNameLength || strings.Contains(got.String(), "橘光柠水随想曲") || !strings.HasSuffix(got.String(), " (files).7z") {
		t.Fatalf("long name %d %q", utf8.RuneCountInString(got.String()), got.String())
	}
	source.Title = strings.Repeat("長", 200)
	source.Translated = strings.Repeat("长", 60)
	if got := download.CanonicalName(download.NameInput{Source: source, Languages: []string{"zh"}, Uploaded: "a.7z"}); strings.Contains(got.String(), "长") || !strings.Contains(got.String(), source.Title) {
		t.Fatalf("the translated title goes first: %q", got.String())
	}
}

func TestNameSuffixKeepsTheVolumeOfASet(t *testing.T) {
	for name, want := range map[string]string{
		"game.7z": ".7z", "game.part03.rar": ".part03.rar", "game.7z.001": ".7z.001", "game.zip.012": ".zip.012", "game.r00": ".r00", "game.z01": ".z01",
		"game.tar.gz": ".tar.gz", "game (iso+mds).rar": ".rar", "noext": "", "weird.name with spaces": "",
	} {
		if got := download.NameSuffix(name); got != want {
			t.Errorf("%q: %q, want %q", name, got, want)
		}
	}
}

func TestNamedMediumReadsADiscFormatFromAnOldName(t *testing.T) {
	for name, want := range map[string]string{
		"[141219][あざらしそふと] アマカノ (iso+mds+rr3).7z":           "iso+mds+rr3",
		"[990101][elf] 同級生 (SD bin+cue rr3).rar":            "SD+bin+cue+rr3",
		"[050527][MOONSTONE] GIFT (iso+mds rr3%).part1.rar": "iso+mds+rr3",
		"[260424][Key] anemoi DL版 (files).7z":               "files",
		"[CIRCUS] D.C.5 初回版 (files+rr3).7z":                 "files+rr3",
		"[920101][elf] 同級生 (PC98).zip":                      "",
		"plain.zip":                                         "",
	} {
		if got := download.NamedMedium(name); got != want {
			t.Errorf("%q: %q, want %q", name, got, want)
		}
	}
}

func TestSourceOfTakesTheOriginalTitleAndTheFirstDeveloper(t *testing.T) {
	released := time.Date(2011, 9, 30, 0, 0, 0, 0, time.UTC)
	card := game.Card{TitleJP: "your diary", TitleZH: "你的日记", TitleEN: "Your Diary", ReleaseDate: &released, Developers: []game.Credit{{Developer: game.DeveloperRef{Name: "CUBE"}}, {Developer: game.DeveloperRef{Name: "Other"}}}}
	if got := download.SourceOf(card); got.Title != "your diary" || got.Translated != "你的日记" || got.Brand != "CUBE" || !got.Released.Equal(released) {
		t.Fatalf("source %+v", got)
	}
	if got := download.SourceOf(game.Card{TitleZH: "神明的一天世界"}); got.Title != "神明的一天世界" || got.Translated != "" || got.Brand != "" || got.Released != nil {
		t.Fatalf("a game with a Chinese title only: %+v", got)
	}
	if got := download.SourceOf(game.Card{TitleEN: "Doki Doki", TitleZH: "心跳文学部"}); got.Title != "Doki Doki" || got.Translated != "心跳文学部" {
		t.Fatalf("an English original: %+v", got)
	}
}
