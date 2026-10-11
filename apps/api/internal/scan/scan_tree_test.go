package scan_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func TestNestedArchiveGoesByExtensionAndLeavesLaterVolumesAlone(t *testing.T) {
	for name, want := range map[string]bool{
		"bonus.zip":            true,
		"Game/特典.ZIP":          true,
		"update.rar":           true,
		"game.part1.rar":       true,
		"game.part01.rar":      true,
		"game.part2.rar":       false,
		"game.part10.rar":      false,
		"data.7z":              true,
		"data.7z.001":          false,
		"data.cab":             false,
		"setup.exe":            false,
		"archive.zip.txt":      false,
		"folder.zip/readme.md": false,
	} {
		if got := scan.NestedArchive(name); got != want {
			t.Errorf("%s: got %v", name, got)
		}
	}
}

func TestContainerKnowsTheFormatsWhoseListingIsAFileTree(t *testing.T) {
	for format, want := range map[string]bool{
		"7z": true, "zip": true, "Rar": true, "Rar5": true, "tar": true, "Iso": true, "Udf": true, "Cab": true,
		"PE": false, "ELF": false, "MachO": false, "Split": false, "": false,
	} {
		if got := scan.Container(format); got != want {
			t.Errorf("%q: got %v", format, got)
		}
	}
}
