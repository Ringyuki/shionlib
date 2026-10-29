package inspection_test

import (
	"testing"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func encodedNames(t *testing.T, target encoding.Encoding, names ...string) []string {
	t.Helper()
	raw := make([]string, len(names))
	for i, name := range names {
		raw[i] = string(encoded(t, target, name))
	}
	return raw
}

func TestDetectNameEncodingReadsJapaneseTitlesWrittenInAChineseCodePage(t *testing.T) {
	cases := map[string][]string{
		"read as big5 before": {
			"絆きらめく恋いろは/",
			"絆きらめく恋いろは/汉化补丁备份/",
			"絆きらめく恋いろは/全CG存档/存档位置.txt",
			"絆きらめく恋いろは/中文攻略.txt",
			"絆きらめく恋いろは/mekuiro.exe",
		},
		"read as euc-jp before": {
			"恋にはあまえが必要です/",
			"恋にはあまえが必要です/汉化补丁单独备份分流/",
			"恋にはあまえが必要です/はじめにお読みください.txt",
		},
	}
	for name, names := range cases {
		t.Run(name, func(t *testing.T) {
			raw := encodedNames(t, simplifiedchinese.GBK, names...)
			if got := inspection.DetectNameEncoding(raw, inspection.EncodingUnknown); got != inspection.EncodingGBK {
				t.Fatalf("detected %q", got)
			}
		})
	}
}

func TestDetectNameEncodingTellsTheCodePagesApart(t *testing.T) {
	cases := []struct {
		target encoding.Encoding
		want   inspection.Encoding
		names  []string
	}{
		{simplifiedchinese.GBK, inspection.EncodingGBK, []string{"说明.txt"}},
		{japanese.ShiftJIS, inspection.EncodingShiftJIS, []string{"ゲーム/セーブデータ/予約特典.dat", "インストール方法.txt"}},
		{japanese.ShiftJIS, inspection.EncodingShiftJIS, []string{"説明書.txt"}},
		{traditionalchinese.Big5, inspection.EncodingBig5, []string{"繁體中文化補丁/說明.txt", "遊戲本體/設定.exe"}},
		{traditionalchinese.Big5, inspection.EncodingBig5, []string{"說明.txt"}},
		{japanese.EUCJP, inspection.EncodingEUCJP, []string{"ゲーム/説明書.txt", "はじめにお読みください.txt"}},
	}
	for _, c := range cases {
		raw := encodedNames(t, c.target, c.names...)
		if got := inspection.DetectNameEncoding(raw, inspection.EncodingUnknown); got != c.want {
			t.Errorf("%q: detected %q, want %q", c.names, got, c.want)
		}
	}
}

func TestDetectNameEncodingKeepsTheEncodingOfAnArchiveWithAnOddName(t *testing.T) {
	raw := encodedNames(t, simplifiedchinese.GBK, "汉化补丁备份/", "汉化补丁备份/使用说明.txt", "日文攻略.txt", "全CG存档/存档位置.txt")
	raw = append(raw, "\xff\xfe.dat")
	if got := inspection.DetectNameEncoding(raw, inspection.EncodingUnknown); got != inspection.EncodingGBK {
		t.Fatalf("detected %q", got)
	}
}

func TestDetectNameEncodingTakesTheExpectedEncodingWhenEveryNameFits(t *testing.T) {
	raw := encodedNames(t, japanese.ShiftJIS, "ｲﾝｽﾄｰﾗ.PIF")
	if got := inspection.DetectNameEncoding(raw, inspection.EncodingShiftJIS); got != inspection.EncodingShiftJIS {
		t.Fatalf("detected %q", got)
	}
	chinese := encodedNames(t, simplifiedchinese.GBK, "使用说明.txt")
	if got := inspection.DetectNameEncoding(chinese, inspection.EncodingShiftJIS); got != inspection.EncodingGBK {
		t.Fatalf("detected %q", got)
	}
}

func TestDetectNameEncodingHasNoLegacyEncodingForUnicodeOrUnreadableNames(t *testing.T) {
	if got := inspection.DetectNameEncoding(nil, inspection.EncodingUnknown); got != inspection.EncodingUnknown {
		t.Fatalf("no names: detected %q", got)
	}
	if got := inspection.DetectNameEncoding([]string{"体験版/説明書.txt"}, inspection.EncodingUnknown); got != inspection.EncodingUTF8 {
		t.Fatalf("unicode: detected %q", got)
	}
	if got := inspection.DetectNameEncoding([]string{"A\xff\xfe\xfdB.BIN"}, inspection.EncodingUnknown); got != inspection.EncodingUnknown {
		t.Fatalf("unreadable: detected %q", got)
	}
}
