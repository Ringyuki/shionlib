package inspection_test

import (
	"slices"
	"testing"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestReadableNamesDecodesTheNamesThatAreNotUnicode(t *testing.T) {
	raw := []string{
		"SETUP.EXE",
		string(encoded(t, japanese.ShiftJIS, "ｲﾝｽﾄｰﾙ.TXT")),
		string(encoded(t, japanese.ShiftJIS, "ソフト/表示.DAT")),
		"日本語.txt",
	}
	names, detected := inspection.ReadableNames(raw, inspection.EncodingShiftJIS)
	if detected != inspection.EncodingShiftJIS {
		t.Fatalf("detected %q", detected)
	}
	if want := []string{"SETUP.EXE", "ｲﾝｽﾄｰﾙ.TXT", "ソフト/表示.DAT", "日本語.txt"}; !slices.Equal(names, want) {
		t.Fatalf("got %q", names)
	}
	chinese, detected := inspection.ReadableNames([]string{string(encoded(t, simplifiedchinese.GBK, "汉化补丁/使用说明.txt"))}, inspection.EncodingUnknown)
	if detected != inspection.EncodingGBK || chinese[0] != "汉化补丁/使用说明.txt" {
		t.Fatalf("got %q in %q", chinese, detected)
	}
}

func TestReadableNamesTakeTheExpectedEncodingWhenTheBytesFitSeveral(t *testing.T) {
	installer := []string{string(encoded(t, japanese.ShiftJIS, "ｲﾝｽﾄｰﾗ.PIF")), string(encoded(t, japanese.ShiftJIS, "RURIIRO/ＹＵＺＯ.読"))}
	guessed, detected := inspection.ReadableNames(installer, inspection.EncodingUnknown)
	if detected != inspection.EncodingGBK || guessed[0] == "ｲﾝｽﾄｰﾗ.PIF" {
		t.Fatalf("half-width katakana reads as chinese without a hint: %q in %q", guessed, detected)
	}
	names, detected := inspection.ReadableNames(installer, inspection.EncodingShiftJIS)
	if detected != inspection.EncodingShiftJIS || !slices.Equal(names, []string{"ｲﾝｽﾄｰﾗ.PIF", "RURIIRO/ＹＵＺＯ.読"}) {
		t.Fatalf("got %q in %q", names, detected)
	}
	chinese, detected := inspection.ReadableNames([]string{string(encoded(t, simplifiedchinese.GBK, "使用说明.txt"))}, inspection.EncodingShiftJIS)
	if detected != inspection.EncodingGBK || chinese[0] != "使用说明.txt" {
		t.Fatalf("names that do not fit the expected encoding are still detected: %q in %q", chinese, detected)
	}
}

func TestReadableNamesLeavesUnicodeNamesAlone(t *testing.T) {
	raw := []string{"SETUP.EXE", "体験版/説明書.txt"}
	names, detected := inspection.ReadableNames(raw, inspection.EncodingShiftJIS)
	if detected != inspection.EncodingUnknown || !slices.Equal(names, raw) {
		t.Fatalf("got %q in %q", names, detected)
	}
}

func TestReadableNamesNeverReturnsBytesThatAreNotText(t *testing.T) {
	names, detected := inspection.ReadableNames([]string{"A\xff\xfe\xfdB.BIN"}, inspection.EncodingShiftJIS)
	if detected != inspection.EncodingUnknown || names[0] != "A�B.BIN" {
		t.Fatalf("got %q in %q", names, detected)
	}
	if got := inspection.ReadableText("DISC\x00\x00\xb2"); got != "DISC�" {
		t.Fatalf("got %q", got)
	}
}

func TestDecodeKnowsOnlyTheLegacyEncodings(t *testing.T) {
	if got, ok := inspection.Decode(encoded(t, japanese.ShiftJIS, "説明書"), inspection.EncodingShiftJIS); !ok || got != "説明書" {
		t.Fatalf("got %q %v", got, ok)
	}
	if _, ok := inspection.Decode([]byte("plain"), inspection.EncodingUTF8); ok {
		t.Fatal("unicode needs no decoding")
	}
}
