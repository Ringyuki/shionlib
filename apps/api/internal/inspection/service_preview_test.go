package inspection_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

var shiftJISReadme = []byte{0x82, 0xB1, 0x82, 0xCC, 0x83, 0x74, 0x83, 0x40, 0x83, 0x43, 0x83, 0x8B, 0x82, 0xCD, 0x90, 0xE0, 0x96, 0xBE, 0x8F, 0x91, 0x82, 0xC5, 0x82, 0xB7, 0x81, 0x42}

func previewed(t *testing.T, f *fixture) inspection.Recorded {
	t.Helper()
	var draft inspection.Draft
	draft.AddTop(inspection.DraftEntry{Name: "readme.txt", Kind: inspection.KindFile, Size: 26})
	draft.AddTop(inspection.DraftEntry{Name: "cover.jpg", Kind: inspection.KindFile, Size: 4})
	draft.AddTop(inspection.DraftEntry{Name: "game.exe", Kind: inspection.KindFile, Size: 4})
	recorded := f.record(t, draft)
	if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[0], inspection.PreviewText, strings.NewReader(string(shiftJISReadme))); err != nil {
		t.Fatal(err)
	}
	if err := f.records().KeepPreview(context.Background(), recorded.ID, recorded.Entries[1], inspection.PreviewImage, strings.NewReader("jpeg")); err != nil {
		t.Fatal(err)
	}
	return recorded
}

func TestTextReturnsTheBytesWithTheEncodingTheyLookLike(t *testing.T) {
	f := newFixture()
	recorded := previewed(t, f)
	f.show(recorded.ID)
	got, err := f.previewService().Text(context.Background(), visitor, recorded.Entries[0])
	if err != nil {
		t.Fatal(err)
	}
	if string(got.Data) != string(shiftJISReadme) || got.Encoding != inspection.EncodingShiftJIS || got.Entry.Name != "readme.txt" {
		t.Fatalf("unexpected text preview %+v", got)
	}
}

func TestImageReturnsTheStoredPicture(t *testing.T) {
	f := newFixture()
	recorded := previewed(t, f)
	f.show(recorded.ID)
	got, err := f.previewService().Image(context.Background(), visitor, recorded.Entries[1])
	if err != nil || string(got) != "webp:jpeg" {
		t.Fatalf("image: %q %v", got, err)
	}
}

func TestAPreviewOfAnotherKindOrOfNoKindIsMissing(t *testing.T) {
	f := newFixture()
	recorded := previewed(t, f)
	f.show(recorded.ID)
	if _, err := f.previewService().Image(context.Background(), visitor, recorded.Entries[0]); !errors.Is(err, inspection.ErrNoPreview) {
		t.Fatalf("a text file as an image: %v", err)
	}
	if _, err := f.previewService().Text(context.Background(), visitor, recorded.Entries[1]); !errors.Is(err, inspection.ErrNoPreview) {
		t.Fatalf("an image as text: %v", err)
	}
	if _, err := f.previewService().Text(context.Background(), visitor, recorded.Entries[2]); !errors.Is(err, inspection.ErrNoPreview) {
		t.Fatalf("an entry without a preview: %v", err)
	}
	if _, err := f.previewService().Text(context.Background(), visitor, 987654); !errors.Is(err, inspection.ErrEntryNotFound) {
		t.Fatalf("a missing entry: %v", err)
	}
}

func TestAPreviewOutsideTheViewersReachDoesNotExist(t *testing.T) {
	f := newFixture()
	recorded := previewed(t, f)
	if _, err := f.previewService().Text(context.Background(), visitor, recorded.Entries[0]); !errors.Is(err, inspection.ErrEntryNotFound) {
		t.Fatalf("an inspection no visible file refers to: %v", err)
	}
	f.resources.Err = download.ErrResourceNotFound
	if _, err := f.previewService().Image(context.Background(), visitor, recorded.Entries[1]); !errors.Is(err, inspection.ErrEntryNotFound) {
		t.Fatalf("a hidden resource: %v", err)
	}
	down := errors.New("database unavailable")
	f.resources.Err = down
	if _, err := f.previewService().Text(context.Background(), visitor, recorded.Entries[0]); !errors.Is(err, down) {
		t.Fatalf("a failure is not a missing entry: %v", err)
	}
}
