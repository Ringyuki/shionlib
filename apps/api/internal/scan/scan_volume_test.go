package scan_test

import (
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

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
		if len(units) != 1 || units[0].Complete() || !slices.Equal(units[0].Missing, tc.missing) || len(units[0].Absent) != len(tc.missing) {
			t.Fatalf("%s: %+v", name, units)
		}
	}
}
