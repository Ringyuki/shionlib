package scan_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const (
	spooled = "/spool/game.part"
	work    = "/work/scan-1"
)

func (f fixture) stock(path, format string, entries ...listed) {
	f.tool.Listings[path] = listing(format, "", entries...)
	f.tool.Contents[path] = names(entries)
}

func (f fixture) read(t *testing.T) (scan.Contents, error) {
	t.Helper()
	archive, err := scan.InspectArchive(context.Background(), f.tool, spooled)
	if err != nil {
		t.Fatal(err)
	}
	return scan.NewContentService(scan.ContentDeps{Archives: f.tool, Names: f.names, Discs: f.discs, Workspace: f.workspace, Spool: f.room, Scanner: f.scanner}).
		Read(context.Background(), scan.Source{Path: spooled, Workspace: work, Archive: archive})
}

func targetNames(contents scan.Contents) []string {
	out := make([]string, len(contents.Targets))
	for i, target := range contents.Targets {
		out[i] = target.Name
	}
	return out
}

func TestContentsListEveryEntryUnderItsFolders(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "Rar5",
		listed{path: "Game", folder: true, modified: "2026-09-25 01:02:03.1234567"},
		listed{path: "Game/game.exe", size: 400, modified: "2026-09-25 01:02:03"},
		file("Game/data/voice.xp3", 9000),
		file(`Game\save\save01.dat`, 20),
		file("readme.txt", 16),
	)
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"folder Game", "file Game/game.exe", "folder Game/data", "file Game/data/voice.xp3", "folder Game/save", "file Game/save/save01.dat", "file readme.txt"}
	if got := tree(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected tree %v", got)
	}
	modified := time.Date(2026, 9, 25, 1, 2, 3, 0, time.UTC)
	if game := entryNamed(contents.Draft, "game.exe"); game.Size != 400 || game.Modified == nil || !game.Modified.Equal(modified) || game.Kind != inspection.KindFile {
		t.Fatalf("unexpected file %+v", game)
	}
	if top := contents.Draft.Entries[0]; top.Modified == nil || top.Modified.Before(modified) || top.Parent != inspection.TopLevel {
		t.Fatalf("a listed folder keeps its date: %+v", top)
	}
	if data := entryNamed(contents.Draft, "data"); data.Modified != nil || data.Kind != inspection.KindFolder {
		t.Fatalf("a folder the listing only implies has no date: %+v", data)
	}
}

func TestContentsPlanOneExtractionForScanningAndPreviews(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z",
		file("Game/game.exe", 400),
		file("Game/readme.txt", 16),
		file("Game/manual/cover.jpg", 5000),
		file("Game/install.bat", 30),
		file("Game/movie.mp4", 9000),
		file("Game/huge.dll", 2<<20),
		file("Game/notes.txt", inspection.TextPreviewMaxBytes+1),
	)
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	selection := f.tool.Selections[0]
	if !slices.Equal(selection.Extensions, scan.ScannedExtensions) || !slices.Equal(selection.Skip, []string{"Game/huge.dll"}) {
		t.Fatalf("unexpected selection %+v", selection)
	}
	if !slices.Equal(selection.Paths, []string{"Game/readme.txt", "Game/manual/cover.jpg"}) {
		t.Fatalf("previews that are not scanned anyway are named one by one, the shallowest first: %v", selection.Paths)
	}
	if got := targetNames(contents); !slices.Equal(got, []string{"Game/game.exe", "Game/install.bat"}) {
		t.Fatalf("unexpected targets %v", got)
	}
	if !slices.Equal(contents.Skipped, []string{"Game/huge.dll"}) {
		t.Fatalf("unexpected skipped %v", contents.Skipped)
	}
	kept := map[string]string{}
	for _, preview := range contents.Previews {
		kept[contents.Draft.Entries[preview.Entry].Name] = string(preview.Kind) + " " + preview.Path
	}
	wantKept := map[string]string{
		"readme.txt":  "text /work/scan-1/contents/Game/readme.txt",
		"cover.jpg":   "image /work/scan-1/contents/Game/manual/cover.jpg",
		"install.bat": "text /work/scan-1/contents/Game/install.bat",
	}
	if len(kept) != len(wantKept) {
		t.Fatalf("unexpected previews %v", kept)
	}
	for name, source := range wantKept {
		if kept[name] != source {
			t.Fatalf("%s: got %q", name, kept[name])
		}
	}
}

func TestContentsOfAFileThatIsNotAnArchiveAreScannedButNotListed(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "PE", file(".text", 100), file(".rsrc/ICON/1.ico", 10), file("installer.exe", 50), file("readme.txt", 5))
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if len(contents.Draft.Entries) != 0 || len(contents.Previews) != 0 {
		t.Fatalf("unexpected draft %+v %+v", contents.Draft.Entries, contents.Previews)
	}
	if got := targetNames(contents); !slices.Equal(got, []string{"installer.exe"}) {
		t.Fatalf("unexpected targets %v", got)
	}
}

func TestContentsNeedRoomForWhatMustBeScanned(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "zip", file("setup.exe", 100), file("cover.png", 500))
	f.room.Room = 99
	if _, err := f.read(t); err == nil || len(f.tool.Extracted) != 0 {
		t.Fatalf("a check without room for the executables fails before extracting: %v %v", err, f.tool.Extracted)
	}
	f.room.Room = 100
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if len(contents.Previews) != 0 || len(f.tool.Selections[0].Paths) != 0 || len(contents.Targets) != 1 {
		t.Fatalf("previews are left out when there is no room for them: %+v %+v", contents.Previews, f.tool.Selections)
	}
}

func TestContentsReadNestedArchivesAndNameWhatIsInside(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z", file("Game/game.exe", 400), file("Game/bonus.zip", 300), file("Game/update.rar", 50), file("Game/broken.7z", 10), file("Game/huge.zip", 2<<20))
	bonus := work + "/contents/Game/bonus.zip"
	f.stock(bonus, "zip", file("wallpaper/a.png", 80), file("setup.exe", 40), file("deeper.7z", 20))
	f.stock(work+"/nested/1/deeper.7z", "7z", file("readme.txt", 5))
	f.tool.Listings[work+"/contents/Game/update.rar"] = scan.ToolRun{Failed: true, Stderr: "Cannot open encrypted archive. Wrong password?"}
	f.tool.Listings[work+"/contents/Game/broken.7z"] = scan.ToolRun{Failed: true, Stderr: "Headers Error"}
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"folder Game", "file Game/game.exe", "archive Game/bonus.zip", "archive Game/update.rar", "archive Game/broken.7z", "archive Game/huge.zip",
		"folder Game/bonus.zip/wallpaper", "file Game/bonus.zip/wallpaper/a.png", "file Game/bonus.zip/setup.exe", "archive Game/bonus.zip/deeper.7z",
		"file Game/bonus.zip/deeper.7z/readme.txt",
	}
	got := tree(contents.Draft)
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("unexpected tree %v", got)
	}
	if nested := entryNamed(contents.Draft, "bonus.zip"); nested.Unreadable || nested.Encrypted || nested.Detail.Format != "zip" || nested.Size != 300 {
		t.Fatalf("unexpected nested archive %+v", nested)
	}
	if locked := entryNamed(contents.Draft, "update.rar"); !locked.Unreadable || !locked.Encrypted {
		t.Fatalf("unexpected encrypted archive %+v", locked)
	}
	if broken := entryNamed(contents.Draft, "broken.7z"); !broken.Unreadable || broken.Encrypted {
		t.Fatalf("unexpected broken archive %+v", broken)
	}
	if huge := entryNamed(contents.Draft, "huge.zip"); !huge.Unreadable || huge.Kind != inspection.KindArchive {
		t.Fatalf("an archive too large to extract is not opened: %+v", huge)
	}
	scanned := targetNames(contents)
	slices.Sort(scanned)
	wantScanned := []string{"Game/bonus.zip", "Game/bonus.zip/deeper.7z", "Game/bonus.zip/setup.exe", "Game/broken.7z", "Game/game.exe", "Game/update.rar"}
	if !slices.Equal(scanned, wantScanned) {
		t.Fatalf("unexpected targets %v", scanned)
	}
	if !slices.Equal(contents.Skipped, []string{"Game/huge.zip"}) {
		t.Fatalf("unexpected skipped %v", contents.Skipped)
	}
	previews := map[string]string{}
	for _, preview := range contents.Previews {
		previews[contents.Draft.Entries[preview.Entry].Name] = preview.Path
	}
	if previews["a.png"] != work+"/nested/1/wallpaper/a.png" || previews["readme.txt"] != work+"/nested/2/readme.txt" {
		t.Fatalf("unexpected previews %v", previews)
	}
}

func TestContentsStopDescendingAtTheDepthLimit(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z", file("level1.zip", 10))
	path := work + "/contents/level1.zip"
	for level := 1; level <= scan.MaxNestingDepth; level++ {
		next := "level" + strconv.Itoa(level+1) + ".zip"
		f.stock(path, "zip", file(next, 10))
		path = work + "/nested/" + strconv.Itoa(level) + "/" + next
	}
	f.stock(path, "zip", file("too-deep.txt", 1))
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"archive level1.zip", "archive level1.zip/level2.zip", "archive level1.zip/level2.zip/level3.zip", "archive level1.zip/level2.zip/level3.zip/level4.zip"}
	if got := tree(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected tree %v", got)
	}
	if deepest := entryNamed(contents.Draft, "level4.zip"); !deepest.Unreadable {
		t.Fatalf("the archive past the limit is listed but not opened: %+v", deepest)
	}
	if slices.Contains(f.tool.Inspected, path) {
		t.Fatal("the archive past the limit must not be listed")
	}
}

func TestContentsTreatOnlyTheFirstVolumeOfANestedSetAsAnArchive(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "zip", file("game.part1.rar", 10), file("game.part2.rar", 10), file("data.bin", 10))
	f.stock(work+"/contents/game.part1.rar", "Rar5", file("game.exe", 15))
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"archive game.part1.rar", "file game.part2.rar", "file data.bin", "file game.part1.rar/game.exe"}
	if got := tree(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected tree %v", got)
	}
}

func TestContentsShowTheDecodedNamesOfALegacyZip(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "zip", file("garbled-1/garbled-2.exe", 10), file("garbled-1/garbled-3.txt", 5), file("bonus.zip", 30))
	f.names.Names[spooled] = scan.LegacyNames{Encoding: "shift_jis", Names: []string{"体験版/ソフト.exe", "体験版/説明書.txt", "bonus.zip"}}
	nested := work + "/contents/bonus.zip"
	f.stock(nested, "zip", file("x.exe", 3))
	f.names.Names[nested] = scan.LegacyNames{Encoding: "gbk", Names: []string{"补丁.exe"}}
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"folder 体験版", "file 体験版/ソフト.exe", "file 体験版/説明書.txt", "archive bonus.zip", "file bonus.zip/补丁.exe"}
	if got := tree(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected tree %v", got)
	}
	if contents.NameEncoding != "shift_jis" {
		t.Fatalf("the encoding of the uploaded archive is the one that is reported: %q", contents.NameEncoding)
	}
	scanned := targetNames(contents)
	slices.Sort(scanned)
	if !slices.Equal(scanned, []string{"bonus.zip", "bonus.zip/补丁.exe", "体験版/ソフト.exe"}) {
		t.Fatalf("scanned files are named as they are shown: %v", scanned)
	}
	if !slices.Equal(f.tool.Selections[0].Paths, []string{"garbled-1/garbled-3.txt"}) {
		t.Fatalf("7-Zip is asked for a file by the name it knows: %v", f.tool.Selections[0].Paths)
	}
	if len(contents.Previews) != 1 || contents.Draft.Entries[contents.Previews[0].Entry].Name != "説明書.txt" || contents.Previews[0].Path != work+"/contents/garbled-1/garbled-3.txt" {
		t.Fatalf("unexpected previews %+v", contents.Previews)
	}
}

func TestContentsIgnoreLegacyNamesThatDoNotLineUpWithTheListing(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "zip", file("a.exe", 10), file("b.txt", 5))
	f.names.Names[spooled] = scan.LegacyNames{Encoding: "shift_jis", Names: []string{"ソフト.exe"}}
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if got := tree(contents.Draft); !slices.Equal(got, []string{"file a.exe", "file b.txt"}) || contents.NameEncoding != "" {
		t.Fatalf("unexpected tree %v %q", got, contents.NameEncoding)
	}
	other := newFixture(true)
	other.stock(spooled, "7z", file("a.exe", 10))
	other.names.Err = errors.New("must not be asked")
	if _, err := other.read(t); err != nil {
		t.Fatalf("only zip archives have legacy names: %v", err)
	}
	failing := newFixture(true)
	failing.stock(spooled, "zip", file("a.exe", 10))
	failing.names.Err = errors.New("disk failure")
	if _, err := failing.read(t); err == nil {
		t.Fatal("a failure to read the names is reported")
	}
}

func TestContentsReadTheNamesOfAnyArchiveThatAreNotUnicode(t *testing.T) {
	f := newFixture(true)
	chinese := "\xba\xba\xbb\xaf\xb2\xb9\xb6\xa1/\xca\xb9\xd3\xc3\xcb\xb5\xc3\xf7.txt"
	f.stock(spooled, "Rar", file(chinese, 5), file("setup.exe", 10))
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if got := tree(contents.Draft); !slices.Equal(got, []string{"folder 汉化补丁", "file 汉化补丁/使用说明.txt", "file setup.exe"}) {
		t.Fatalf("unexpected tree %q", got)
	}
	if contents.NameEncoding != "gbk" {
		t.Fatalf("the encoding the names were read in is reported: %q", contents.NameEncoding)
	}
	mixed := newFixture(true)
	mixed.stock(spooled, "Rar", file(chinese, 5), file("broken\xff\x00.dat", 1))
	contents, err = mixed.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if got := tree(contents.Draft); !slices.Equal(got, []string{"folder 汉化补丁", "file 汉化补丁/使用说明.txt", "file broken\uFFFD.dat"}) || contents.NameEncoding != "" {
		t.Fatalf("a name no encoding explains does not spoil the others: %q %q", got, contents.NameEncoding)
	}
}

func TestContentsShareThePreviewAllowanceAcrossNestedArchives(t *testing.T) {
	f := newFixture(true)
	entries := []listed{file("bonus.zip", 10)}
	for i := range inspection.TextPreviewLimit + 3 {
		entries = append(entries, file("docs/note"+strconv.Itoa(i)+".txt", 4))
	}
	entries = append(entries, file("readme.txt", 4))
	f.stock(spooled, "7z", entries...)
	f.stock(work+"/contents/bonus.zip", "zip", file("inner.txt", 4), file("inner.png", 4))
	contents, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	texts, images := 0, 0
	kept := map[string]bool{}
	for _, preview := range contents.Previews {
		kept[contents.Draft.Entries[preview.Entry].Name] = true
		if preview.Kind == inspection.PreviewText {
			texts++
		} else {
			images++
		}
	}
	if texts != inspection.TextPreviewLimit || images != 1 || !kept["readme.txt"] || kept["inner.txt"] || !kept["inner.png"] {
		t.Fatalf("kept %d texts and %d images, readme=%v inner.txt=%v", texts, images, kept["readme.txt"], kept["inner.txt"])
	}
}

func TestContentsFailWhenTheUploadedArchiveCannotBeExtracted(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z", file("game.exe", 10), file("bonus.zip", 10))
	f.tool.Extracts = map[string]scan.ToolRun{spooled: {Failed: true, ExitCode: 2, Message: "exit status 2"}}
	if _, err := f.read(t); err == nil {
		t.Fatal("expected a failure")
	}
	nested := newFixture(true)
	nested.stock(spooled, "7z", file("game.exe", 10), file("bonus.zip", 10))
	inner := work + "/contents/bonus.zip"
	nested.stock(inner, "zip", file("setup.exe", 5))
	nested.tool.Extracts = map[string]scan.ToolRun{inner: {Failed: true, ExitCode: 2, Message: "exit status 2"}}
	contents, err := nested.read(t)
	if err != nil {
		t.Fatal(err)
	}
	scanned := targetNames(contents)
	slices.Sort(scanned)
	if !slices.Equal(scanned, []string{"bonus.zip", "bonus.zip/setup.exe", "game.exe"}) || entryNamed(contents.Draft, "setup.exe").Name == "" {
		t.Fatalf("a nested archive whose extraction fails is still listed and scanned, whole and in what came out: %v %v", scanned, tree(contents.Draft))
	}
}
