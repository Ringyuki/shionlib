package inspection_test

import (
	"bytes"
	"testing"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func encoded(t *testing.T, target encoding.Encoding, text string) []byte {
	t.Helper()
	data, err := target.NewEncoder().Bytes([]byte(text))
	if err != nil {
		t.Fatalf("encode %q: %v", text, err)
	}
	return data
}

func TestDetectEncodingTellsTheLegacyEncodingsApart(t *testing.T) {
	for _, tc := range []struct {
		name   string
		target encoding.Encoding
		text   string
		want   inspection.Encoding
	}{
		{"a japanese readme", japanese.ShiftJIS, "このファイルは説明書です。インストール方法を記載しています。", inspection.EncodingShiftJIS},
		{"japanese names in kanji", japanese.ShiftJIS, "体験版/修正差分.exe", inspection.EncodingShiftJIS},
		{"japanese names in katakana", japanese.ShiftJIS, "データ/セーブ.dat", inspection.EncodingShiftJIS},
		{"a japanese name of one word", japanese.ShiftJIS, "特典.zip", inspection.EncodingShiftJIS},
		{"a japanese readme with half-width katakana", japanese.ShiftJIS, "ｲﾝｽﾄｰﾙ方法：セットアップを実行してください。ゲームを開始します。", inspection.EncodingShiftJIS},
		{"simplified chinese names", simplifiedchinese.GBK, "汉化补丁/使用说明.txt", inspection.EncodingGBK},
		{"a simplified chinese readme", simplifiedchinese.GBK, "本补丁仅供学习交流使用，请在下载后二十四小时内删除。", inspection.EncodingGBK},
		{"a simplified chinese name of one word", simplifiedchinese.GBK, "说明.txt", inspection.EncodingGBK},
		{"traditional chinese names", traditionalchinese.Big5, "漢化補丁/使用說明.txt", inspection.EncodingBig5},
		{"a traditional chinese readme", traditionalchinese.Big5, "本補丁僅供學習交流使用，請在下載後二十四小時內刪除。", inspection.EncodingBig5},
		{"a japanese readme from unix", japanese.EUCJP, "このファイルは説明書です。インストール方法を記載しています。", inspection.EncodingEUCJP},
	} {
		if got := inspection.DetectEncoding(encoded(t, tc.target, tc.text)); got != tc.want {
			t.Errorf("%s: got %q want %q", tc.name, got, tc.want)
		}
	}
}

func TestDetectEncodingRecognisesUnicode(t *testing.T) {
	utf8Text := []byte("このファイルは説明書です")
	for name, tc := range map[string]struct {
		data []byte
		want inspection.Encoding
	}{
		"ascii":                        {[]byte("readme.txt"), inspection.EncodingUTF8},
		"nothing":                      {nil, inspection.EncodingUTF8},
		"utf-8":                        {utf8Text, inspection.EncodingUTF8},
		"utf-8 cut inside a character": {utf8Text[:len(utf8Text)-1], inspection.EncodingUTF8},
		"utf-8 with a mark":            {append([]byte{0xEF, 0xBB, 0xBF}, 0xFF), inspection.EncodingUTF8},
		"utf-16 little endian":         {[]byte{0xFF, 0xFE, 'a', 0}, inspection.EncodingUTF16LE},
		"utf-16 big endian":            {[]byte{0xFE, 0xFF, 0, 'a'}, inspection.EncodingUTF16BE},
		"bytes of no known encoding":   {[]byte{0xFF, 0xFF, 0x80, 0x80}, inspection.EncodingUnknown},
	} {
		if got := inspection.DetectEncoding(tc.data); got != tc.want {
			t.Errorf("%s: got %q want %q", name, got, tc.want)
		}
	}
}

func TestDetectEncodingReadsOnlyTheStartOfALongSample(t *testing.T) {
	head := bytes.Repeat(encoded(t, japanese.ShiftJIS, "これは説明書です。"), inspection.EncodingSampleBytes/18+1)
	tail := encoded(t, simplifiedchinese.GBK, "汉化补丁使用说明")
	if got := inspection.DetectEncoding(append(head, bytes.Repeat(tail, 100_000)...)); got != inspection.EncodingShiftJIS {
		t.Fatalf("got %q", got)
	}
}
