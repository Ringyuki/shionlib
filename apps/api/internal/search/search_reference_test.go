package search_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func TestParseReferenceReadsHikarinagiVNDBAndBangumiIDs(t *testing.T) {
	for raw, want := range map[string]game.Reference{
		"hid:12":   {Source: game.ReferenceHikarinagi, Number: 12},
		" HID 12 ": {Source: game.ReferenceHikarinagi, Number: 12},
		"hid：12":   {Source: game.ReferenceHikarinagi, Number: 12},
		"bid:345":  {Source: game.ReferenceBangumi, Number: 345},
		"bid345":   {Source: game.ReferenceBangumi, Number: 345},
		"vid:17":   {Source: game.ReferenceVNDB, Number: 17},
		"vid: v17": {Source: game.ReferenceVNDB, Number: 17},
		"V17":      {Source: game.ReferenceVNDB, Number: 17},
	} {
		got, ok := search.ParseReference(raw)
		if !ok || got != want {
			t.Fatalf("%q: got %+v %v, want %+v", raw, got, ok, want)
		}
	}
	for _, raw := range []string{"12", "hid:v12", "bid:v3", "hid:0", "hid:", "sakura 17", "v17 sakura", "hid:1234567890"} {
		if got, ok := search.ParseReference(raw); ok {
			t.Fatalf("%q is not a reference, got %+v", raw, got)
		}
	}
	if key := (game.Reference{Source: game.ReferenceVNDB, Number: 17}).Key(); key != "v17" {
		t.Fatalf("VNDB keys keep their prefix: %q", key)
	}
}
