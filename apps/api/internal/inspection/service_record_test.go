package inspection_test

import (
	"bytes"
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func childNames(t *testing.T, f *fixture, inspectionID int, parent *int) []string {
	t.Helper()
	entries, _, err := f.repo.Children(context.Background(), inspectionID, parent, firstPage)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, len(entries))
	for i, entry := range entries {
		names[i] = entry.Name
	}
	return names
}

func entryOf(t *testing.T, f *fixture, id int) inspection.Entry {
	t.Helper()
	entry, err := f.repo.GetEntry(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return entry
}

func TestRecordCountsWhatTheArchiveHoldsApartFromWhatItsImagesHold(t *testing.T) {
	f := newFixture()
	draft := discArchive()
	draft.Archive = inspection.Archive{Format: "rar5"}
	recorded := f.record(t, draft)
	got, err := f.repo.Get(context.Background(), recorded.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Totals != (inspection.Totals{Files: 4, Folders: 3, Size: 1055, Discs: 1, DiscFiles: 4}) {
		t.Fatalf("unexpected totals %+v", got.Totals)
	}
	if got.Truncated || got.Archive.Format != "rar5" || got.ResourceID != f.resource {
		t.Fatalf("unexpected inspection %+v", got)
	}
	root := entryOf(t, f, recorded.Entries[0])
	if root.Items != 4 || root.Children != 4 || root.Size != 1055 || root.ParentID != nil {
		t.Fatalf("unexpected root folder %+v", root)
	}
	disc := entryOf(t, f, recorded.Entries[4])
	if disc.Items != 4 || disc.Children != 3 || disc.Size != 1000 || disc.Detail.Label != "ANNA" || disc.ParentID == nil || *disc.ParentID != root.ID {
		t.Fatalf("unexpected disc %+v", disc)
	}
	game := entryOf(t, f, recorded.Entries[5])
	if game.Items != 2 || game.Children != 2 || game.Size != 450 {
		t.Fatalf("unexpected folder inside the disc %+v", game)
	}
	if bonus := entryOf(t, f, recorded.Entries[7]); bonus.Items != 1 || bonus.Children != 1 || bonus.Size != 50 {
		t.Fatalf("unexpected nested archive %+v", bonus)
	}
	if empty := entryOf(t, f, recorded.Entries[12]); empty.Items != 0 || empty.Children != 0 || empty.Size != 0 {
		t.Fatalf("unexpected empty folder %+v", empty)
	}
}

func TestRecordPutsFoldersFirstThenNamesInNaturalOrderAndTracksLast(t *testing.T) {
	f := newFixture()
	recorded := f.record(t, discArchive())
	if got := childNames(t, f, recorded.ID, &recorded.Entries[0]); !slices.Equal(got, []string{"Empty", "jpg", "ANNA.iso", "ANNA.mds"}) {
		t.Fatalf("root children: %v", got)
	}
	if got := childNames(t, f, recorded.ID, &recorded.Entries[1]); !slices.Equal(got, []string{"cover2.jpg", "cover10.jpg"}) {
		t.Fatalf("numbers are compared by value: %v", got)
	}
	if got := childNames(t, f, recorded.ID, &recorded.Entries[4]); !slices.Equal(got, []string{"Game", "setup.exe", "Track 02"}) {
		t.Fatalf("disc children: %v", got)
	}
}

func TestRecordKeepsTheFirstEntriesOfAnOversizedListing(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	folder := draft.AddTop(inspection.DraftEntry{Name: "voice", Kind: inspection.KindFolder})
	for i := range inspection.EntryLimit + 4 {
		draft.Add(inspection.DraftEntry{Parent: folder, Name: "v_" + strconv.Itoa(i) + ".ogg", Kind: inspection.KindFile, Size: 2})
	}
	recorded := f.record(t, draft)
	got, err := f.repo.Get(context.Background(), recorded.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Truncated || got.Totals.Files != inspection.EntryLimit+4 || got.Totals.Size != 2*(inspection.EntryLimit+4) {
		t.Fatalf("unexpected inspection %+v", got)
	}
	if len(recorded.Entries) != inspection.EntryLimit {
		t.Fatalf("kept %d entries", len(recorded.Entries))
	}
	_, stored, err := f.repo.Children(context.Background(), recorded.ID, &recorded.Entries[0], inspection.Page{Number: 1, Size: 1})
	if err != nil || stored != inspection.EntryLimit-1 {
		t.Fatalf("stored %d children: %v", stored, err)
	}
	if voice := entryOf(t, f, recorded.Entries[0]); voice.Items != inspection.EntryLimit+4 || voice.Children != inspection.EntryLimit+4 {
		t.Fatalf("the folder counts everything it holds: %+v", voice)
	}
}

func TestRecordLeavesNothingBehindForAMissingResource(t *testing.T) {
	f := newFixture()
	draft := discArchive()
	draft.ResourceID = 987654
	draft.Status = inspection.StatusReady
	if _, err := f.records().Record(context.Background(), draft); !errors.Is(err, inspection.ErrResourceGone) {
		t.Fatalf("record: %v", err)
	}
}

func TestKeepPreviewStoresTextAsItIsAndFlagsTheEntry(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "readme.txt", Kind: inspection.KindFile, Size: 5})
	recorded := f.record(t, draft)
	entry := recorded.Entries[0]
	if err := f.records().KeepPreview(context.Background(), recorded.ID, entry, inspection.PreviewText, strings.NewReader("hello")); err != nil {
		t.Fatal(err)
	}
	key := "inspections/" + strconv.Itoa(recorded.ID) + "/" + strconv.Itoa(entry)
	if got := f.previews.Objects[key]; string(got) != "hello" {
		t.Fatalf("stored %q under %v", got, f.previews.Keys())
	}
	if got := entryOf(t, f, entry); got.Preview != inspection.PreviewText {
		t.Fatalf("unexpected entry %+v", got)
	}
}

func TestKeepPreviewSkipsWhatCannotBeShown(t *testing.T) {
	oversized := bytes.Repeat([]byte("a"), inspection.TextPreviewMaxBytes+1)
	for name, tc := range map[string]struct {
		kind       inspection.Preview
		content    []byte
		unreadable bool
	}{
		"binary data in a text file":      {kind: inspection.PreviewText, content: []byte{'M', 'Z', 0, 0, 3}},
		"an empty text file":              {kind: inspection.PreviewText, content: nil},
		"a text file over the limit":      {kind: inspection.PreviewText, content: oversized},
		"an image that cannot be decoded": {kind: inspection.PreviewImage, content: []byte("not an image"), unreadable: true},
		"an entry without a preview kind": {kind: inspection.PreviewNone, content: []byte("text")},
	} {
		t.Run(name, func(t *testing.T) {
			f := newFixture()
			f.images.Unreadable = tc.unreadable
			var draft inspection.Draft
			draft.AddTop(inspection.DraftEntry{Name: "file", Kind: inspection.KindFile, Size: 5})
			recorded := f.record(t, draft)
			if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[0], tc.kind, bytes.NewReader(tc.content)); err != nil {
				t.Fatal(err)
			}
			if len(f.previews.Keys()) != 0 || entryOf(t, f, recorded.Entries[0]).Preview != inspection.PreviewNone {
				t.Fatalf("a preview was kept: %v", f.previews.Keys())
			}
		})
	}
}

func TestKeepPreviewStoresImagesShrunk(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "cover.jpg", Kind: inspection.KindFile, Size: 4})
	recorded := f.record(t, draft)
	if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[0], inspection.PreviewImage, strings.NewReader("jpeg")); err != nil {
		t.Fatal(err)
	}
	key := f.previews.Keys()[0]
	if string(f.previews.Objects[key]) != "webp:jpeg" || f.previews.Types[key] != inspection.PreviewImageType {
		t.Fatalf("stored %q as %q", f.previews.Objects[key], f.previews.Types[key])
	}
	if got := entryOf(t, f, recorded.Entries[0]); got.Preview != inspection.PreviewImage {
		t.Fatalf("unexpected entry %+v", got)
	}
}

func TestKeepPreviewReportsAStoreThatFails(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "readme.txt", Kind: inspection.KindFile, Size: 5})
	recorded := f.record(t, draft)
	down := errors.New("bucket unavailable")
	f.previews.Err = down
	if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[0], inspection.PreviewText, strings.NewReader("hello")); !errors.Is(err, down) {
		t.Fatalf("keep preview: %v", err)
	}
	if got := entryOf(t, f, recorded.Entries[0]); got.Preview != inspection.PreviewNone {
		t.Fatalf("the entry must not claim a preview: %+v", got)
	}
}

func TestClearedStampsTheInspections(t *testing.T) {
	f := newFixture()
	recorded := f.record(t, discArchive())
	if err := f.records().Cleared(context.Background(), []int{recorded.ID}); err != nil {
		t.Fatal(err)
	}
	got, err := f.repo.Get(context.Background(), recorded.ID)
	if err != nil || got.Scan.ClearedAt == nil || !got.Scan.ClearedAt.Equal(f.clock) {
		t.Fatalf("cleared: %+v %v", got.Scan, err)
	}
	if err := f.records().Cleared(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
}

func TestSweepRemovesOldInspectionsNoFileRefersToWithTheirPreviews(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "readme.txt", Kind: inspection.KindFile, Size: 5})
	orphan, current := f.record(t, draft), f.record(t, draft)
	f.show(current.ID)
	for _, recorded := range []inspection.Recorded{orphan, current} {
		if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[0], inspection.PreviewText, strings.NewReader("hello")); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.records().Sweep(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(context.Background(), orphan.ID); err != nil {
		t.Fatalf("a fresh inspection is still being attached: %v", err)
	}
	f.clock = f.clock.Add(2 * time.Hour)
	if err := f.records().Sweep(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.Get(context.Background(), orphan.ID); !errors.Is(err, inspection.ErrNotFound) {
		t.Fatalf("orphan: %v", err)
	}
	if _, err := f.repo.Get(context.Background(), current.ID); err != nil {
		t.Fatalf("current: %v", err)
	}
	keys := f.previews.Keys()
	if len(keys) != 1 || !strings.HasPrefix(keys[0], "inspections/"+strconv.Itoa(current.ID)+"/") {
		t.Fatalf("remaining previews: %v", keys)
	}
}

func TestSweepKeepsAnInspectionWhosePreviewsCannotBeRemoved(t *testing.T) {
	f := newFixture()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "readme.txt", Kind: inspection.KindFile, Size: 5})
	orphan := f.record(t, draft)
	if err := f.records().KeepPreview(context.Background(), orphan.ID, orphan.Entries[0], inspection.PreviewText, strings.NewReader("hello")); err != nil {
		t.Fatal(err)
	}
	f.clock = f.clock.Add(2 * time.Hour)
	down := errors.New("bucket unavailable")
	f.previews.Err = down
	if err := f.records().Sweep(context.Background()); !errors.Is(err, down) {
		t.Fatalf("sweep: %v", err)
	}
	if _, err := f.repo.Get(context.Background(), orphan.ID); err != nil {
		t.Fatalf("the inspection must stay until its previews are gone: %v", err)
	}
}
