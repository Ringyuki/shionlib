package scan_test

import (
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func TestParseVolume(t *testing.T) {
	cases := map[string]scan.Volume{
		"Game.part1.rar":   {Scheme: scan.SchemeRarParts, Base: "game", Index: 1},
		"Game.PART012.RAR": {Scheme: scan.SchemeRarParts, Base: "game", Index: 12},
		"ゲーム.rar":          {Scheme: scan.SchemeRarLegacy, Base: "ゲーム", Index: 1},
		"ゲーム.r00":          {Scheme: scan.SchemeRarLegacy, Base: "ゲーム", Index: 2},
		"ゲーム.r09":          {Scheme: scan.SchemeRarLegacy, Base: "ゲーム", Index: 11},
		"game.7z.001":      {Scheme: scan.SchemeSplit, Base: "game.7z", Index: 1},
		"game.iso.010":     {Scheme: scan.SchemeSplit, Base: "game.iso", Index: 10},
		"game.z01":         {Scheme: scan.SchemeZipSplit, Base: "game", Index: 1},
	}
	for name, want := range cases {
		if got, ok := scan.ParseVolume(name); !ok || got != want {
			t.Fatalf("%s: got %+v %v, want %+v", name, got, ok, want)
		}
	}
	if got, ok := scan.ParseVolume("game.zip"); !ok || got.Scheme != scan.SchemeZipSplit || got.Base != "game" {
		t.Fatalf("a zip may close a split zip: %+v %v", got, ok)
	}
	for _, name := range []string{"game.7z", "readme.txt", "game.000", "setup.exe"} {
		if got, ok := scan.ParseVolume(name); ok {
			t.Fatalf("%s is not a volume: %+v", name, got)
		}
	}
}

func files(names ...string) []scan.PendingFile {
	out := make([]scan.PendingFile, len(names))
	for i, name := range names {
		out[i] = scan.PendingFile{ID: i + 1, Name: name, Created: now.Add(time.Duration(i) * time.Minute)}
	}
	return out
}

func TestUnitsGroupVolumeSets(t *testing.T) {
	units := scan.Units(files("game.part2.rar", "readme.txt", "game.part1.rar", "patch.rar", "ost.zip", "ost.z01", "bonus.7z.002", "bonus.7z.001", "solo.zip"))
	got := map[string]scan.Unit{}
	for _, unit := range units {
		got[unit.Entry().Name] = unit
	}
	if len(units) != 6 {
		t.Fatalf("units: %+v", units)
	}
	if rar := got["game.part1.rar"]; !rar.Set() || !rar.Complete() || !slices.Equal(rar.Names(), []string{"game.part1.rar", "game.part2.rar"}) {
		t.Fatalf("rar parts: %+v", rar)
	}
	if zip := got["ost.zip"]; !zip.Set() || !zip.Complete() || !slices.Equal(zip.Names(), []string{"ost.z01", "ost.zip"}) {
		t.Fatalf("a split zip is opened from its .zip, the last volume: %+v", zip)
	}
	if split := got["bonus.7z.001"]; !split.Set() || !slices.Equal(split.Names(), []string{"bonus.7z.001", "bonus.7z.002"}) {
		t.Fatalf("split archive: %+v", split)
	}
	for _, name := range []string{"readme.txt", "patch.rar", "solo.zip"} {
		if unit := got[name]; unit.Set() || len(unit.Files) != 1 {
			t.Fatalf("%s stands alone: %+v", name, unit)
		}
	}
	if !got["game.part1.rar"].Oldest().Equal(now) {
		t.Fatalf("the oldest volume dates the set: %s", got["game.part1.rar"].Oldest())
	}
}

func TestUnitsReportMissingVolumes(t *testing.T) {
	cases := map[string]struct {
		names   []string
		missing []int
	}{
		"gap in rar parts":       {[]string{"g.part1.rar", "g.part2.rar", "g.part4.rar"}, []int{3}},
		"no first rar part":      {[]string{"g.part2.rar", "g.part3.rar"}, []int{1}},
		"legacy rar without rar": {[]string{"g.r00", "g.r01"}, []int{1}},
		"legacy rar gap":         {[]string{"g.rar", "g.r00", "g.r02"}, []int{3}},
		"split gap":              {[]string{"g.7z.001", "g.7z.003"}, []int{2}},
		"zip without its last":   {[]string{"g.z01", "g.z02"}, []int{3}},
		"zip gap":                {[]string{"g.z02", "g.zip"}, []int{1}},
	}
	for name, tc := range cases {
		units := scan.Units(files(tc.names...))
		if len(units) != 1 || units[0].Complete() || !slices.Equal(units[0].Missing, tc.missing) {
			t.Fatalf("%s: %+v", name, units)
		}
	}
}
