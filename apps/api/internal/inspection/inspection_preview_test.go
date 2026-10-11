package inspection_test

import (
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func TestPreviewableGoesByNameAndSize(t *testing.T) {
	for _, tc := range []struct {
		name string
		size int64
		want inspection.Preview
	}{
		{"readme.txt", 16_000, inspection.PreviewText},
		{"Game/README", 900, inspection.PreviewText},
		{"GAME.CUE", 412, inspection.PreviewText},
		{`Game\setup.INI`, 841, inspection.PreviewText},
		{"readme.txt", inspection.TextPreviewMaxBytes, inspection.PreviewText},
		{"readme.txt", inspection.TextPreviewMaxBytes + 1, inspection.PreviewNone},
		{"readme.txt", 0, inspection.PreviewNone},
		{"jpg/ジャケット表.JPG", 5_820_000, inspection.PreviewImage},
		{"cover.webp", inspection.ImagePreviewMaxBytes, inspection.PreviewImage},
		{"cover.png", inspection.ImagePreviewMaxBytes + 1, inspection.PreviewNone},
		{"manual.pdf", 100, inspection.PreviewNone},
		{"icon.svg", 100, inspection.PreviewNone},
		{"game.exe", 100, inspection.PreviewNone},
		{"readme", 100, inspection.PreviewText},
		{"readme.txt.sig", 212, inspection.PreviewNone},
	} {
		if got := inspection.Previewable(tc.name, tc.size); got != tc.want {
			t.Errorf("%s (%d bytes): got %q want %q", tc.name, tc.size, got, tc.want)
		}
	}
}

func TestPickPreviewsTakesTheShallowestFilesOfEachKindUpToItsLimit(t *testing.T) {
	var candidates []inspection.Candidate
	for i := range inspection.TextPreviewLimit + 5 {
		candidates = append(candidates, inspection.Candidate{Index: i, Depth: 3, Kind: inspection.PreviewText})
	}
	shallow := inspection.Candidate{Index: 9000, Depth: 1, Kind: inspection.PreviewText}
	image := inspection.Candidate{Index: 9001, Depth: 7, Kind: inspection.PreviewImage}
	picked := inspection.PickPreviews(append(candidates, shallow, image))
	if len(picked) != inspection.TextPreviewLimit+1 {
		t.Fatalf("picked %d", len(picked))
	}
	if picked[0] != shallow || picked[len(picked)-1] != image {
		t.Fatalf("the shallowest comes first and each kind has its own limit: %+v … %+v", picked[0], picked[len(picked)-1])
	}
	if picked[1].Index != 0 || picked[inspection.TextPreviewLimit-1].Index != inspection.TextPreviewLimit-2 {
		t.Fatalf("files of one depth are taken in their order: %+v", picked[:3])
	}
}

func TestLooksLikeTextRejectsBinaryData(t *testing.T) {
	for name, tc := range map[string]struct {
		data []byte
		want bool
	}{
		"plain text":            {[]byte("hello\r\nworld"), true},
		"shift_jis text":        {[]byte{0x82, 0xB1, 0x82, 0xCC}, true},
		"utf-16 with a mark":    {[]byte{0xFF, 0xFE, 'a', 0, 'b', 0}, true},
		"an executable":         {[]byte{'M', 'Z', 0x90, 0, 3, 0}, false},
		"nothing":               {nil, false},
		"utf-16 without a mark": {[]byte{'a', 0, 'b', 0}, false},
	} {
		if got := inspection.LooksLikeText(tc.data); got != tc.want {
			t.Errorf("%s: got %v", name, got)
		}
	}
}
