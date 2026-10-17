package moyu_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
)

func TestParseAddress(t *testing.T) {
	for raw, want := range map[string]moyu.Address{
		"212857":                                  {Page: "212857"},
		" 0212857 ":                               {Page: "212857"},
		"https://www.moyu.moe/galgame/212857":     {Page: "212857"},
		"http://moyu.moe/galgame/3125/":           {Page: "3125"},
		"www.moyu.moe/galgame/3125?tab=resources": {Page: "3125"},
		"HTTPS://WWW.MOYU.MOE/galgame/3125#top":   {Page: "3125"},
		"https://www.moyu.moe/resource/11421":     {Resource: "11421"},
		"moyu.moe/resource/11421":                 {Resource: "11421"},
	} {
		got, ok := moyu.ParseAddress(raw)
		if !ok || got != want {
			t.Fatalf("%q: %+v %v", raw, got, ok)
		}
	}
	for _, raw := range []string{
		"", "abc", "-1", "1.5", "https://www.moyu.moe/galgame/", "https://www.moyu.moe/galgame/abc",
		"https://evil.example/galgame/3125", "https://www.moyu.moe.evil.example/galgame/3125",
		"https://www.moyu.moe/user/1", "https://www.moyu.moe/galgame/3125/resource/1", "1234567890123",
	} {
		if got, ok := moyu.ParseAddress(raw); ok {
			t.Fatalf("%q is not an address of a page: %+v", raw, got)
		}
	}
}

func TestIsPageID(t *testing.T) {
	for id, want := range map[string]bool{"3125": true, "0": true, "03125": false, "": false, "v3125": false, "1234567890123": false} {
		if got := moyu.IsPageID(id); got != want {
			t.Fatalf("%q: %v", id, got)
		}
	}
}
