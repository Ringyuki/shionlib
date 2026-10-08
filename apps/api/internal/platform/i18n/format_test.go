package i18n

import "testing"

func TestFormatFillsArgumentsAndLeavesUnknownOnesAsWritten(t *testing.T) {
	got := format("文件 {file_name}（#{case}）共 {count} 个，{missing}", map[string]any{"file_name": "a.7z", "case": float64(12), "count": 3})
	if got != "文件 a.7z（#12）共 3 个，{missing}" {
		t.Fatalf("got %q", got)
	}
	if got := format("no arguments", nil); got != "no arguments" {
		t.Fatalf("got %q", got)
	}
	if got := format("names: {names}", map[string]any{"names": []any{"a", "b"}}); got != "names: a, b" {
		t.Fatalf("lists are joined: %q", got)
	}
}

func TestFormatSelectsASentenceByValue(t *testing.T) {
	const message = "已放行。{note, select, none {} other {备注：{note}}}"
	for name, tc := range map[string]struct {
		args map[string]any
		want string
	}{
		"missing":      {map[string]any{}, "已放行。"},
		"null":         {map[string]any{"note": nil}, "已放行。"},
		"empty string": {map[string]any{"note": " "}, "已放行。"},
		"present":      {map[string]any{"note": "误报"}, "已放行。备注：误报"},
	} {
		if got := format(message, tc.args); got != tc.want {
			t.Fatalf("%s: got %q want %q", name, got, tc.want)
		}
	}
	const days = "{ban_days, select, none {} other {封禁 {ban_days} 天。}}{demoted, select, true {已降档。} other {}}"
	if got := format(days, map[string]any{"ban_days": float64(0), "demoted": false}); got != "" {
		t.Fatalf("zero and false count as absent: %q", got)
	}
	if got := format(days, map[string]any{"ban_days": float64(7), "demoted": true}); got != "封禁 7 天。已降档。" {
		t.Fatalf("got %q", got)
	}
	const exact = "{level, select, LOW {低} HIGH {高} other {未知}}"
	if got := format(exact, map[string]any{"level": "HIGH"}); got != "高" {
		t.Fatalf("got %q", got)
	}
	if got := format(exact, map[string]any{"level": "X"}); got != "未知" {
		t.Fatalf("got %q", got)
	}
}

func TestFormatKeepsMalformedTextAsWritten(t *testing.T) {
	for _, message := range []string{"open {brace", "{name, plural, one {x} other {y}}"} {
		if got := format(message, map[string]any{"name": 1}); got != message {
			t.Fatalf("%q became %q", message, got)
		}
	}
}
