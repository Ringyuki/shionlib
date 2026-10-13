package download_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func TestParseVolume(t *testing.T) {
	cases := map[string]download.Volume{
		"Game.part1.rar":   {Scheme: download.SchemeRarParts, Base: "game", Index: 1},
		"Game.PART012.RAR": {Scheme: download.SchemeRarParts, Base: "game", Index: 12},
		"ゲーム.rar":          {Scheme: download.SchemeRarLegacy, Base: "ゲーム", Index: 1},
		"ゲーム.r00":          {Scheme: download.SchemeRarLegacy, Base: "ゲーム", Index: 2},
		"ゲーム.r09":          {Scheme: download.SchemeRarLegacy, Base: "ゲーム", Index: 11},
		"game.7z.001":      {Scheme: download.SchemeSplit, Base: "game.7z", Index: 1},
		"game.iso.010":     {Scheme: download.SchemeSplit, Base: "game.iso", Index: 10},
		"game.z01":         {Scheme: download.SchemeZipSplit, Base: "game", Index: 1},
	}
	for name, want := range cases {
		if got, ok := download.ParseVolume(name); !ok || got != want {
			t.Fatalf("%s: got %+v %v, want %+v", name, got, ok, want)
		}
	}
	if got, ok := download.ParseVolume("game.zip"); !ok || got.Scheme != download.SchemeZipSplit || got.Base != "game" {
		t.Fatalf("a zip may close a split zip: %+v %v", got, ok)
	}
	for _, name := range []string{"game.7z", "readme.txt", "game.000", "setup.exe"} {
		if got, ok := download.ParseVolume(name); ok {
			t.Fatalf("%s is not a volume: %+v", name, got)
		}
	}
}

func named(names []string, set download.VolumeSet) []string {
	out := make([]string, len(set.Members))
	for i, position := range set.Members {
		out[i] = names[position]
	}
	return out
}

func TestVolumeSetsKeepEachSetTogetherAndInItsOwnOrder(t *testing.T) {
	names := []string{"game.r00", "patch.zip", "game.r01", "game.rar", "bonus.part10.rar", "bonus.part2.rar", "bonus.part1.rar", "ost.zip", "ost.z01", "readme.txt"}
	sets := download.VolumeSets(names)
	want := [][]string{
		{"game.rar", "game.r00", "game.r01"},
		{"patch.zip"},
		{"bonus.part1.rar", "bonus.part2.rar", "bonus.part10.rar"},
		{"ost.z01", "ost.zip"},
		{"readme.txt"},
	}
	if len(sets) != len(want) {
		t.Fatalf("sets: %+v", sets)
	}
	for i, set := range sets {
		if got := named(names, set); !slices.Equal(got, want[i]) || set.Set() != (len(want[i]) > 1) {
			t.Fatalf("set %d: got %v, want %v (%+v)", i, got, want[i], set)
		}
	}
	if absent := sets[2].Absent; !slices.Equal(absent, []string{"bonus.part3.rar", "bonus.part4.rar", "bonus.part5.rar", "bonus.part6.rar", "bonus.part7.rar", "bonus.part8.rar", "bonus.part9.rar"}) {
		t.Fatalf("the gap in the parts: %v", absent)
	}
}

func TestVolumeSetsNameTheVolumesThatAreNotThereAsTheirSiblingsAreNamed(t *testing.T) {
	cases := map[string]struct {
		names  []string
		absent []string
	}{
		"rar part":                {[]string{"[Maker] ゲーム.part1.rar", "[Maker] ゲーム.part3.rar"}, []string{"[Maker] ゲーム.part2.rar"}},
		"padded rar part":         {[]string{"g.part01.rar", "g.part03.rar"}, []string{"g.part02.rar"}},
		"first rar part":          {[]string{"g.part2.rar", "g.part3.rar"}, []string{"g.part1.rar"}},
		"upper-case rar part":     {[]string{"G.PART1.RAR", "G.PART3.RAR"}, []string{"G.PART2.RAR"}},
		"legacy rar without rar":  {[]string{"g.r00", "g.r01"}, []string{"g.rar"}},
		"legacy rar gap":          {[]string{"g.rar", "g.r00", "g.r02"}, []string{"g.r01"}},
		"upper-case legacy rar":   {[]string{"G.RAR", "G.R01"}, []string{"G.R00"}},
		"split":                   {[]string{"g.7z.001", "g.7z.003"}, []string{"g.7z.002"}},
		"zip without the zip":     {[]string{"g.z01", "g.z02"}, []string{"g.zip"}},
		"zip gap":                 {[]string{"g.z02", "g.zip"}, []string{"g.z01"}},
		"zip gap and no zip":      {[]string{"g.z01", "g.z03"}, []string{"g.z02", "g.zip"}},
		"complete":                {[]string{"g.part1.rar", "g.part2.rar"}, nil},
		"a rar by itself":         {[]string{"g.rar"}, nil},
		"a zip by itself":         {[]string{"g.zip"}, nil},
		"one part of a rar":       {[]string{"g.part1.rar"}, nil},
		"the second part of some": {[]string{"g.part2.rar"}, []string{"g.part1.rar"}},
	}
	for name, tc := range cases {
		sets := download.VolumeSets(tc.names)
		if len(sets) != 1 || !slices.Equal(sets[0].Absent, tc.absent) || len(sets[0].Missing) != len(tc.absent) {
			t.Fatalf("%s: %+v", name, sets)
		}
	}
}

func TestArrangedOrdersWhatItIsGivenByItsNames(t *testing.T) {
	type file struct {
		id   int
		name string
	}
	files := []file{{1, "g.part3.rar"}, {2, "extra.7z"}, {3, "g.part1.rar"}, {4, "g.part2.rar"}}
	arranged := download.Arranged(files, func(f file) string { return f.name })
	ids := make([]int, len(arranged))
	for i, f := range arranged {
		ids[i] = f.id
	}
	if !slices.Equal(ids, []int{3, 4, 1, 2}) {
		t.Fatalf("arranged %v", ids)
	}
	if len(download.Arranged([]file{}, func(f file) string { return f.name })) != 0 {
		t.Fatal("nothing stays nothing")
	}
}
