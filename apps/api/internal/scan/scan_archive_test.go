package scan_test

import (
	"context"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
)

const rar5Listing = `
7-Zip (z) 25.01 (arm64) : Copyright (c) 1999-2025 Igor Pavlov : 2025-08-03

Scanning the drive for archives:
1 file, 20971520 bytes (20 MiB)

Listing archive: game.part1.rar

--
Path = game.part1.rar
Type = Rar5
Physical Size = 20971520
Total Physical Size = 61860833
Characteristics = Volume Recovery Locator QuickOpen:20341086 Recovery:20341167
Encrypted = -
Solid = -
Blocks = 6
Method = v6:512K:m0:m3
Multivolume = +
Volume Index = 0
Volumes = 3

----------
Path = ゲーム
Folder = +
Size = 0
Packed Size = 0
Modified = 2026-10-11 15:38:12.590936900
Attributes = D drwxr-xr-x
Encrypted = -

Path = ゲーム/readme.txt
Folder = -
Size = 14
Packed Size = 14
Modified = 2013-07-27 04:00:00
Created = 
Attributes =  -rw-r--r--
Encrypted = -
Solid = -
CRC = E2A23026
Characteristics = UnixTime CRC

Path = ゲーム/data
Size = 0
Packed Size = 0
Modified = 
Attributes = D
Encrypted = -
`

func inspect(t *testing.T, stdout string) scan.Archive {
	t.Helper()
	tool := &scantest.ArchiveTool{Listings: map[string]scan.ToolRun{"f": {Stdout: stdout}}, Tests: map[string]scan.ToolRun{}}
	got, err := scan.InspectArchive(context.Background(), tool, "f")
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestInspectArchiveReadsTheFactsInTheListingHeader(t *testing.T) {
	got := inspect(t, rar5Listing)
	if got.Facts != (scan.ArchiveFacts{Format: "rar5", Volumes: 3, Recovery: true, RecoveryPercent: 3}) || !got.Verified {
		t.Fatalf("unexpected facts %+v verified=%v", got.Facts, got.Verified)
	}
	for header, want := range map[string]scan.ArchiveFacts{
		"Type = 7z\nPhysical Size = 100\nSolid = +\n":                                           {Format: "7z", Solid: true},
		"Type = Rar\nPhysical Size = 100\nCharacteristics = Recovery NewVolName\nVolumes = 1\n": {Format: "rar", Recovery: true, Volumes: 1},
		"Type = Rar5\nPhysical Size = 100\nCharacteristics = Locator QuickOpen:90\nSolid = -\n": {Format: "rar5"},
		"Type = Rar5\nPhysical Size = 100\nCharacteristics = Recovery Recovery:0\n":             {Format: "rar5", Recovery: true},
		"Type = Rar5\nPhysical Size = 100\nCharacteristics = Recovery Recovery:500\n":           {Format: "rar5", Recovery: true},
		"Type = zip\nPhysical Size = 100\n":                                                     {Format: "zip"},
	} {
		if got := inspect(t, "--\nPath = f\n"+header+"\n----------\nPath = a.txt\nSize = 1\n").Facts; got != want {
			t.Errorf("%q: got %+v", header, got)
		}
	}
	if got := inspect(t, "Path = f\nType = 7z\n\n----------\nPath = a.txt\nSize = 1\n").Facts; got != (scan.ArchiveFacts{}) {
		t.Fatalf("a listing without a header block tells nothing: %+v", got)
	}
}

func TestInspectArchiveReadsEachEntryWithItsDateAndWhetherItIsAFolder(t *testing.T) {
	entries := inspect(t, rar5Listing).Entries
	if len(entries) != 3 {
		t.Fatalf("unexpected entries %+v", entries)
	}
	if top := entries[0]; top.Path != "ゲーム" || !top.Folder || top.Modified == nil || !top.Modified.Equal(time.Date(2026, 10, 11, 15, 38, 12, 590936900, time.UTC)) {
		t.Fatalf("unexpected folder %+v", top)
	}
	if readme := entries[1]; readme.Path != "ゲーム/readme.txt" || readme.Folder || readme.Size != 14 || readme.Encrypted || readme.Modified == nil || !readme.Modified.Equal(time.Date(2013, 7, 27, 4, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected file %+v", readme)
	}
	if data := entries[2]; !data.Folder || data.Modified != nil {
		t.Fatalf("a folder is also told by its attributes, and an empty date is no date: %+v", data)
	}
}

func TestInspectNestedListsWithoutTesting(t *testing.T) {
	tool := &scantest.ArchiveTool{
		Listings: map[string]scan.ToolRun{"inner.zip": {Stdout: "--\nPath = inner.zip\nType = zip\n\n----------\nPath = a.txt\nSize = 1\n"}, "locked.rar": {Failed: true, Stderr: "Wrong password"}},
		Tests:    map[string]scan.ToolRun{"inner.zip": {Failed: true, Stdout: "Data Error"}},
	}
	got, err := scan.InspectNested(context.Background(), tool, "inner.zip")
	if err != nil || got.Status != 1 || got.Verified || got.Facts.Format != "zip" || len(got.Entries) != 1 {
		t.Fatalf("unexpected nested archive %+v %v", got, err)
	}
	locked, err := scan.InspectNested(context.Background(), tool, "locked.rar")
	if err != nil || locked.Status != 4 || len(locked.Entries) != 0 {
		t.Fatalf("unexpected locked archive %+v %v", locked, err)
	}
}
