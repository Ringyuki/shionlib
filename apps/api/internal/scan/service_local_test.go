package scan_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const stagedPatch = "/stage/7/inputs/patch.zip"

func stagedFile(resourceID int) scan.LocalFile {
	return scan.LocalFile{ResourceID: resourceID, Name: "patch.zip", Path: stagedPatch, Size: 400}
}

func localPaths(finding scan.LocalFinding) []string {
	out := make([]string, len(finding.Files))
	for i, file := range finding.Files {
		out[i] = file.Path
	}
	slices.Sort(out)
	return out
}

func TestALocalArchiveIsExaminedWithoutBelongingToAResource(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	f.tool.Contents[stagedPatch] = []string{"patch/chs.exe", "patch/data/script.pak", "patch/inner.zip", "readme.txt"}
	f.tool.Listings[stagedPatch] = listing("zip", "", listed{path: "patch", folder: true}, file("patch/chs.exe", 100), file("patch/data/script.pak", 250), file("patch/inner.zip", 40), file("readme.txt", 10))

	finding, err := scan.NewLocalService(f.service).Examine(ctx, stagedFile(0), false)
	if err != nil || finding.Status != download.CheckOK || !finding.Container || finding.Infected() {
		t.Fatalf("finding: %+v %v", finding, err)
	}
	if !slices.Equal(localPaths(finding), []string{"patch/chs.exe", "patch/data/script.pak", "patch/inner.zip", "readme.txt"}) {
		t.Fatalf("the files of the archive with their folders: %v", localPaths(finding))
	}
	if finding.Format != "zip" || finding.Unpacked != 400 {
		t.Fatalf("format and unpacked size: %q %d", finding.Format, finding.Unpacked)
	}
	if finding.SHA256 == "" || finding.InspectionID != 0 || len(f.inspections.Drafts) != 0 {
		t.Fatalf("nothing is recorded unless asked: %+v drafts=%d", finding, len(f.inspections.Drafts))
	}
	if !slices.Equal(f.scanner.Scanned, []string{"patch/chs.exe", "patch/inner.zip"}) {
		t.Fatalf("its programs and inner archives are scanned: %v", f.scanner.Scanned)
	}
	if len(f.events.Jobs()) != 0 || len(f.events.Activities()) != 0 || len(f.events.Messages()) != 0 {
		t.Fatal("examining a local archive touches no file of a resource")
	}

	recorded, err := scan.NewLocalService(f.service).Examine(ctx, stagedFile(70), true)
	if err != nil || recorded.InspectionID != 1 || recorded.SHA256 != finding.SHA256 || len(f.inspections.Drafts) != 1 || f.inspections.Drafts[0].ResourceID != 70 {
		t.Fatalf("recorded for its resource: %+v %v", recorded, err)
	}
}

func TestALocalArchiveThatIsHarmfulOrUnreadableIsReportedNotRecorded(t *testing.T) {
	ctx := context.Background()
	f := newFixture(true)
	f.tool.Contents[stagedPatch] = []string{"patch/chs.exe"}
	f.tool.Listings[stagedPatch] = listing("zip", "", file("patch/chs.exe", 100))
	f.scanner.Reports["patch/chs.exe"] = scan.Report{Infected: true, Viruses: []string{"Eicar"}}
	harmful, err := scan.NewLocalService(f.service).Examine(ctx, stagedFile(70), true)
	if err != nil || !harmful.Infected() || len(harmful.Detections) != 1 || harmful.Detections[0].Path != "patch/chs.exe" || harmful.InspectionID != 0 || len(f.inspections.Drafts) != 0 {
		t.Fatalf("harmful: %+v %v", harmful, err)
	}

	locked := newFixture(true)
	locked.tool.Listings[stagedPatch] = scan.ToolRun{Failed: true, Stderr: "ERROR: Wrong password"}
	finding, err := scan.NewLocalService(locked.service).Examine(ctx, stagedFile(70), true)
	if err != nil || finding.Status != download.CheckEncrypted || len(finding.Files) != 0 || finding.InspectionID != 0 {
		t.Fatalf("encrypted: %+v %v", finding, err)
	}

	if _, err := scan.NewLocalService(newFixture(false).service).Examine(ctx, stagedFile(70), true); !errors.Is(err, scan.ErrChecksDisabled) {
		t.Fatalf("checks switched off: %v", err)
	}
}
