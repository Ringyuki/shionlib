package setting_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting/settingtest"
)

func TestDeclaredKeysAreListedWithTheirBounds(t *testing.T) {
	window, ok := setting.Find("fixture.window")
	if !ok {
		t.Fatal("fixture.window is not registered")
	}
	if window.Kind != setting.KindDuration || window.Group() != "fixture" || window.Label != "窗口" {
		t.Fatalf("window definition: %+v", window)
	}
	if string(window.Default) != "3600" || string(window.Min) != "1" || string(window.Max) != "172800" {
		t.Fatalf("durations are listed in seconds: default=%s min=%s max=%s", window.Default, window.Min, window.Max)
	}
	note, _ := setting.Find("fixture.note")
	if note.Kind != setting.KindText || note.MaxLength != 4 || string(note.Default) != `"默认"` || note.Min != nil {
		t.Fatalf("note definition: %+v", note)
	}
	secret, _ := setting.Find("fixture.secret")
	if secret.Kind != setting.KindSecret || secret.MaxLength != 40 || string(secret.Default) != `""` {
		t.Fatalf("secret definition: %+v", secret)
	}
	var names []string
	for _, def := range setting.Definitions() {
		names = append(names, def.Name)
	}
	want := []string{"fixture.limit", "fixture.note", "fixture.open", "fixture.quota", "fixture.secret", "fixture.weight", "fixture.window"}
	if len(names) != len(want) {
		t.Fatalf("definitions: %v", names)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("definitions are sorted by name: %v", names)
		}
	}
}

func TestReadFallsBackToTheDefault(t *testing.T) {
	source := settingtest.Source{}
	if testLimit.Read(source) != 10 || testQuota.Read(source) != 5<<30 || testWindow.Read(source) != time.Hour || !testOpen.Read(source) || testNote.Read(source) != "默认" {
		t.Fatal("an empty source must yield the declared defaults")
	}
	settingtest.Set(source, testLimit, 42)
	source["fixture.window"] = "not a duration"
	if testLimit.Read(source) != 42 || testWindow.Read(source) != time.Hour {
		t.Fatalf("read: limit=%d window=%s", testLimit.Read(source), testWindow.Read(source))
	}
}

func TestDeclarationsRejectInconsistentSpecs(t *testing.T) {
	cases := map[string]func(){
		"name without a group": func() { setting.Int(setting.Spec[int]{Name: "limit", Label: "x", Max: 1}) },
		"name in camel case":   func() { setting.Int(setting.Spec[int]{Name: "fixture.maxConns", Label: "x", Max: 1}) },
		"missing label":        func() { setting.Int(setting.Spec[int]{Name: "fixture.unlabelled", Max: 1}) },
		"duplicate name":       func() { setting.Int(setting.Spec[int]{Name: "fixture.limit", Label: "x", Max: 1}) },
		"default above max":    func() { setting.Int(setting.Spec[int]{Name: "fixture.over", Label: "x", Default: 2, Max: 1}) },
		"fractional seconds": func() {
			setting.Duration(setting.Spec[time.Duration]{Name: "fixture.fraction", Label: "x", Default: time.Millisecond, Max: time.Second})
		},
		"text without max length": func() { setting.Text(setting.Spec[string]{Name: "fixture.free", Label: "x"}) },
		"secret with a default": func() {
			setting.Secret(setting.Spec[string]{Name: "fixture.known", Label: "x", Default: "x", MaxLength: 9})
		},
		"secret without length": func() { setting.Secret(setting.Spec[string]{Name: "fixture.endless", Label: "x"}) },
	}
	for name, declare := range cases {
		t.Run(name, func(t *testing.T) {
			defer func() {
				if recover() == nil {
					t.Fatal("declaration must panic")
				}
			}()
			declare()
		})
	}
}

func TestDefinitionsNormalizeValidValues(t *testing.T) {
	cases := []struct {
		name, raw, want string
	}{
		{"fixture.limit", ` 42 `, `42`},
		{"fixture.quota", `1099511627776`, `1099511627776`},
		{"fixture.weight", `1.50`, `1.5`},
		{"fixture.window", `90`, `90`},
		{"fixture.open", `false`, `false`},
		{"fixture.note", `"四个字符"`, `"四个字符"`},
	}
	for _, tc := range cases {
		def, _ := setting.Find(tc.name)
		got, err := def.Normalize(json.RawMessage(tc.raw))
		if err != nil || string(got) != tc.want {
			t.Fatalf("%s %s: got %s, %v", tc.name, tc.raw, got, err)
		}
	}
	window, _ := setting.Find("fixture.window")
	if parsed, err := window.Parse(json.RawMessage(`90`)); err != nil || parsed != 90*time.Second {
		t.Fatalf("durations parse from seconds: %v %v", parsed, err)
	}
}

func TestDefinitionsRejectInvalidValues(t *testing.T) {
	cases := []struct {
		name, raw string
	}{
		{"fixture.limit", `0`},
		{"fixture.limit", `101`},
		{"fixture.limit", `1.5`},
		{"fixture.limit", `"10"`},
		{"fixture.limit", `null`},
		{"fixture.limit", `1 2`},
		{"fixture.quota", `-1`},
		{"fixture.weight", `10.5`},
		{"fixture.window", `0`},
		{"fixture.window", `1.5`},
		{"fixture.open", `null`},
		{"fixture.open", `1`},
		{"fixture.note", `"五个字符了"`},
		{"fixture.note", `null`},
		{"fixture.note", ``},
	}
	for _, tc := range cases {
		def, _ := setting.Find(tc.name)
		if _, err := def.Normalize(json.RawMessage(tc.raw)); !errorsIs(err, setting.ErrInvalidValue) {
			t.Fatalf("%s %q: %v", tc.name, tc.raw, err)
		}
	}
}
