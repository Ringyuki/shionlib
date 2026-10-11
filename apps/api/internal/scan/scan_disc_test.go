package scan_test

import (
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

const contents = work + "/contents/"

func TestDiscImagesAreListedScannedAndPreviewedLikeFolders(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "Rar5", file("Game/ANNA.iso", 5000), file("Game/ANNA.mds", 200), file("Game/readme.txt", 10))
	f.discs.Volumes[contents+"Game/ANNA.iso"] = scan.DiscVolume{Readable: true, Format: "iso9660+joliet", Label: "ANNAFFIARE", Bytes: 5000}
	f.discs.Sheets[contents+"Game/ANNA.mds"] = scan.DiscSheet{DPM: true, Tracks: []scan.DiscTrack{{Number: 1, Frames: 2}}}
	f.stock(contents+"Game/ANNA.iso", "Iso",
		listed{path: "[BOOT]", folder: true}, file("[BOOT]/Boot-NoEmul.img", 2048),
		file("Annaffiare/data.xp3", 3000), file("setup.exe", 100), file("readme.txt", 9), file("autorun.inf", 48))
	got, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"folder Game", "disc Game/ANNA.iso", "file Game/ANNA.mds", "file Game/readme.txt",
		"folder Game/ANNA.iso/Annaffiare", "file Game/ANNA.iso/Annaffiare/data.xp3", "file Game/ANNA.iso/setup.exe", "file Game/ANNA.iso/readme.txt", "file Game/ANNA.iso/autorun.inf",
	}
	if listing := tree(got.Draft); !slices.Equal(listing, want) {
		t.Fatalf("unexpected tree %v", listing)
	}
	disc := entryNamed(got.Draft, "ANNA.iso")
	if disc.Unreadable || disc.Size != 5000 || disc.Detail.Format != "iso9660+joliet" || disc.Detail.Label != "ANNAFFIARE" || disc.Detail.Files != 4 || disc.Detail.Folders != 1 || !slices.Equal(disc.Detail.Signals, []string{scan.SignalDPM}) {
		t.Fatalf("unexpected disc %+v", disc)
	}
	if !slices.Equal(f.tool.Selections[0].Paths, []string{"Game/ANNA.iso", "Game/ANNA.mds", "Game/readme.txt"}) {
		t.Fatalf("the image comes out with its sheet: %v", f.tool.Selections[0].Paths)
	}
	if scanned := targetNames(got); !slices.Equal(scanned, []string{"Game/ANNA.iso/setup.exe"}) {
		t.Fatalf("unexpected targets %v", scanned)
	}
	previewed := map[string]bool{}
	for _, preview := range got.Previews {
		previewed[tree(got.Draft)[preview.Entry]] = true
	}
	if !previewed["file Game/ANNA.iso/readme.txt"] || !previewed["file Game/ANNA.iso/autorun.inf"] || !previewed["file Game/readme.txt"] {
		t.Fatalf("unexpected previews %v", previewed)
	}
	if len(f.discs.Cooked) != 0 {
		t.Fatalf("a standard image is listed as it is: %v", f.discs.Cooked)
	}
}

func TestRawImagesAreRestoredBeforeTheyAreListedAndTheirAudioTracksFollow(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z", file("GAME.BIN", 9000), file("game.cue", 300), file("data.bin", 50), file("DISC2.img", 700), file("DISC2.ccd", 90), file("DISC2.sub", 30))
	f.discs.Volumes[contents+"GAME.BIN"] = scan.DiscVolume{Readable: true, Raw: true, Format: "iso9660", Label: "GAME", Bytes: 4096}
	f.discs.Sheets[contents+"game.cue"] = scan.DiscSheet{Tracks: []scan.DiscTrack{{Number: 1, Frames: 2}, {Number: 2, Audio: true, Frames: 20_340}, {Number: 3, Audio: true}}}
	restored := work + "/nested/1.iso"
	f.stock(restored, "Iso", file("SETUP.EXE", 268))
	got, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"disc GAME.BIN", "file game.cue", "file data.bin", "disc DISC2.img", "file DISC2.ccd", "file DISC2.sub",
		"file GAME.BIN/SETUP.EXE", "track GAME.BIN/Track 02", "track GAME.BIN/Track 03",
	}
	if listing := tree(got.Draft); !slices.Equal(listing, want) {
		t.Fatalf("unexpected tree %v", listing)
	}
	if f.discs.Cooked[restored] != contents+"GAME.BIN" {
		t.Fatalf("the raw image is restored into the workspace: %v", f.discs.Cooked)
	}
	first := entryNamed(got.Draft, "GAME.BIN")
	if first.Kind != inspection.KindDisc || first.Unreadable || !slices.Equal(first.Detail.Signals, []string{scan.SignalAudio}) || first.Detail.Files != 1 {
		t.Fatalf("unexpected first image %+v", first)
	}
	track := entryNamed(got.Draft, "Track 02")
	if track.Kind != inspection.KindTrack || track.Size != 20_340*2352 || track.Detail.Track != 2 || track.Detail.Seconds != 271 {
		t.Fatalf("unexpected track %+v", track)
	}
	second := entryNamed(got.Draft, "DISC2.img")
	if second.Kind != inspection.KindDisc || !second.Unreadable || !slices.Equal(second.Detail.Signals, []string{scan.SignalSubchannel}) {
		t.Fatalf("an image nothing can read is still an image, with what its files tell: %+v", second)
	}
	if plain := entryNamed(got.Draft, "data.bin"); plain.Kind != inspection.KindFile {
		t.Fatalf("a .bin without a sheet is a plain file: %+v", plain)
	}
	if scanned := targetNames(got); !slices.Equal(scanned, []string{"GAME.BIN/SETUP.EXE"}) {
		t.Fatalf("unexpected targets %v", scanned)
	}
}

func TestImagesWaitForRoomAndForDepth(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "7z", file("setup.exe", 100), file("BIG.iso", 5000), file("SMALL.mdf", 400), file("SMALL.mds", 10))
	f.room.Room = 900
	f.discs.Volumes[contents+"SMALL.mdf"] = scan.DiscVolume{Readable: true, Raw: true, Subchannel: true, Format: "iso9660", Bytes: 600}
	got, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if big := entryNamed(got.Draft, "BIG.iso"); big.Kind != inspection.KindDisc || !big.Unreadable {
		t.Fatalf("an image there is no room to extract is not read: %+v", big)
	}
	if slices.Contains(f.tool.Selections[0].Paths, "BIG.iso") || !slices.Contains(f.tool.Selections[0].Paths, "SMALL.mdf") {
		t.Fatalf("unexpected selection %v", f.tool.Selections[0].Paths)
	}
	small := entryNamed(got.Draft, "SMALL.mdf")
	if !small.Unreadable || len(f.discs.Cooked) != 0 || !slices.Equal(small.Detail.Signals, []string{scan.SignalSubchannel}) {
		t.Fatalf("an image there is no room to restore is not read: %+v %v", small, f.discs.Cooked)
	}

	deep := newFixture(true)
	deep.stock(spooled, "7z", file("a.zip", 10))
	path := work + "/contents/a.zip"
	for level := 1; level < scan.MaxNestingDepth; level++ {
		deep.stock(path, "zip", file("inner.zip", 10))
		path = work + "/nested/" + string(rune('0'+level)) + "/inner.zip"
	}
	deep.stock(path, "zip", file("LAST.iso", 10))
	nested, err := deep.read(t)
	if err != nil {
		t.Fatal(err)
	}
	if last := entryNamed(nested.Draft, "LAST.iso"); last.Kind != inspection.KindDisc || !last.Unreadable {
		t.Fatalf("an image past the depth limit is listed but not opened: %+v", last)
	}
}

func TestAnImage7ZipCannotListIsUnreadable(t *testing.T) {
	f := newFixture(true)
	f.stock(spooled, "zip", file("GAME.nrg", 100), file("DISC.cdi", 100))
	f.discs.Volumes[contents+"GAME.nrg"] = scan.DiscVolume{Readable: true, Format: "udf", Bytes: 100}
	f.tool.Listings[contents+"GAME.nrg"] = scan.ToolRun{Failed: true, Stderr: "Cannot open the file as archive"}
	got, err := f.read(t)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"GAME.nrg", "DISC.cdi"} {
		if image := entryNamed(got.Draft, name); image.Kind != inspection.KindDisc || !image.Unreadable || image.Detail.Format != "" {
			t.Fatalf("unexpected image %+v", image)
		}
	}
}

func TestDiscTracksKnowTheirLengthAndSize(t *testing.T) {
	track := scan.DiscTrack{Number: 2, Audio: true, Frames: 20_340}
	if track.Seconds() != 271 || track.Bytes() != 47_839_680 {
		t.Fatalf("got %d seconds and %d bytes", track.Seconds(), track.Bytes())
	}
}
