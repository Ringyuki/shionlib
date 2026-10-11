package scan_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

func TestScannedCoversExecutablesScriptsAndArchives(t *testing.T) {
	for name, want := range map[string][2]bool{
		"Game/SETUP.EXE": {true, true},
		"plugin.dll":     {true, true},
		"install.bat":    {true, true},
		"patch.zip":      {true, false},
		"data.cab":       {true, false},
		"readme.txt":     {false, false},
		"disc.iso":       {false, false},
		"noextension":    {false, false},
	} {
		if scan.Scanned(name) != want[0] || scan.Executable(name) != want[1] {
			t.Errorf("%s: scanned=%v executable=%v", name, scan.Scanned(name), scan.Executable(name))
		}
	}
}

func TestDetectionsPairEachSignatureWithTheFileItWasFoundIn(t *testing.T) {
	got := scan.Detections([]scan.EntryReport{
		{Name: "Game/clean.dll", Report: scan.Report{}},
		{Name: "Game/setup.exe", Report: scan.Report{Infected: true, Viruses: []string{" Eicar ", "Eicar", "Trojan", ""}}},
		{Name: "bonus.zip/run.exe", Report: scan.Report{Infected: true, Viruses: []string{"Win.Malware.Generic-9917"}}},
	})
	want := []inspection.Detection{
		{Path: "Game/setup.exe", Signature: "Eicar"},
		{Path: "Game/setup.exe", Signature: "Trojan"},
		{Path: "bonus.zip/run.exe", Signature: "Win.Malware.Generic-9917"},
	}
	if !slices.Equal(got, want) {
		t.Fatalf("got %+v", got)
	}
	if none := scan.Detections(nil); none == nil || len(none) != 0 {
		t.Fatalf("a clean scan has an empty list: %+v", none)
	}
}

func TestExecutablesLeavesOutTheArchivesThatWereScannedWhole(t *testing.T) {
	got := scan.Executables([]scan.EntryReport{{Name: "Game/setup.exe"}, {Name: "Game/plugin.DLL"}, {Name: "bonus.zip"}, {Name: "bonus.zip/run.bat"}, {Name: "data.cab"}})
	if got != 3 {
		t.Fatalf("got %d", got)
	}
}
