package imaging

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/gen2brain/avif"
	"github.com/gen2brain/webp"

	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func sample(width, height int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			img.Set(x, y, color.NRGBA{R: uint8(x), G: uint8(y), B: 128, A: 255})
		}
	}
	img.Set(0, 0, color.NRGBA{R: 255, A: 255})
	return img
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func decodeWebP(t *testing.T, encoded media.Encoded) image.Image {
	t.Helper()
	if encoded.ContentType != "image/webp" || encoded.Extension != ".webp" {
		t.Fatalf("unexpected output type %+v", encoded)
	}
	img, err := webp.Decode(bytes.NewReader(encoded.Data))
	if err != nil {
		t.Fatal(err)
	}
	return img
}

func TestResizesInsideTheBounds(t *testing.T) {
	ctx := context.Background()
	p := NewTranscoder()
	data := encodePNG(t, sample(400, 300))
	cases := []struct {
		bounds        media.Bounds
		width, height int
	}{
		{media.Bounds{MaxWidth: 233, MaxHeight: 233}, 233, 175},
		{media.Bounds{MaxWidth: 1500}, 1500, 1125},
		{media.Bounds{}, 400, 300},
	}
	for _, tc := range cases {
		encoded, err := p.ToWebP(ctx, data, tc.bounds)
		if err != nil {
			t.Fatal(err)
		}
		if got := decodeWebP(t, encoded).Bounds(); got.Dx() != tc.width || got.Dy() != tc.height {
			t.Fatalf("bounds %+v: got %dx%d want %dx%d", tc.bounds, got.Dx(), got.Dy(), tc.width, tc.height)
		}
	}
}

func TestAppliesJPEGOrientation(t *testing.T) {
	var buf bytes.Buffer
	marked := image.NewNRGBA(image.Rect(0, 0, 40, 20))
	for y := range 20 {
		for x := range 40 {
			if x < 8 && y < 8 {
				marked.Set(x, y, color.NRGBA{R: 255, A: 255})
			} else {
				marked.Set(x, y, color.NRGBA{A: 255})
			}
		}
	}
	if err := jpeg.Encode(&buf, marked, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	raw := buf.Bytes()
	tiff := []byte{'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1}
	entry := make([]byte, 12)
	binary.BigEndian.PutUint16(entry[0:2], orientationTag)
	binary.BigEndian.PutUint16(entry[2:4], 3)
	binary.BigEndian.PutUint32(entry[4:8], 1)
	binary.BigEndian.PutUint16(entry[8:10], 6)
	tiff = append(append(tiff, entry...), 0, 0, 0, 0)
	segment := append([]byte("Exif\x00\x00"), tiff...)
	app1 := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(app1[2:4], uint16(len(segment)+2))
	withExif := append(append(append([]byte{}, raw[:2]...), append(app1, segment...)...), raw[2:]...)
	if jpegOrientation(withExif) != 6 {
		t.Fatalf("orientation not parsed")
	}
	encoded, err := NewTranscoder().ToWebP(context.Background(), withExif, media.Bounds{})
	if err != nil {
		t.Fatal(err)
	}
	img := decodeWebP(t, encoded)
	if img.Bounds().Dx() != 20 || img.Bounds().Dy() != 40 {
		t.Fatalf("rotation must swap the dimensions: %v", img.Bounds())
	}
	if r, _, _, _ := img.At(17, 2).RGBA(); r>>8 < 160 {
		t.Fatalf("the top-left block must move to the top-right after a clockwise rotation")
	}
	if r, _, _, _ := img.At(2, 2).RGBA(); r>>8 > 80 {
		t.Fatalf("the top-left corner must be dark after rotation")
	}
}

func TestOrientTransforms(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	src.Set(0, 0, color.NRGBA{R: 1, A: 255})
	src.Set(1, 0, color.NRGBA{R: 2, A: 255})
	expect := map[int][]uint8{2: {2, 1}, 3: {2, 1}, 4: {1, 2}, 5: {1, 2}, 6: {1, 2}, 7: {2, 1}, 8: {2, 1}}
	for orientation, want := range expect {
		out := orient(src, orientation)
		var got []uint8
		for y := range out.Rect.Dy() {
			for x := range out.Rect.Dx() {
				got = append(got, out.NRGBAAt(x, y).R)
			}
		}
		if got[0] != want[0] || got[1] != want[1] {
			t.Fatalf("orientation %d: got %v want %v", orientation, got, want)
		}
	}
}

func TestDecodesWebPAndAVIF(t *testing.T) {
	ctx := context.Background()
	var webpInput, avifInput bytes.Buffer
	if err := webp.Encode(&webpInput, sample(64, 32)); err != nil {
		t.Fatal(err)
	}
	if err := avif.Encode(&avifInput, sample(64, 32)); err != nil {
		t.Fatal(err)
	}
	for name, data := range map[string][]byte{"webp": webpInput.Bytes(), "avif": avifInput.Bytes()} {
		encoded, err := NewTranscoder().ToWebP(ctx, data, media.Bounds{MaxWidth: 32})
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if got := decodeWebP(t, encoded).Bounds(); got.Dx() != 32 || got.Dy() != 16 {
			t.Fatalf("%s: unexpected size %v", name, got)
		}
	}
}

func TestRejectsUndecodableInput(t *testing.T) {
	if _, err := NewTranscoder().ToWebP(context.Background(), []byte("not an image"), media.Bounds{}); !errors.Is(err, upload.ErrSmallFileUnsupported) {
		t.Fatalf("expected unsupported type, got %v", err)
	}
	huge := encodePNG(t, image.NewNRGBA(image.Rect(0, 0, 1, 1)))
	binary.BigEndian.PutUint32(huge[16:20], 20000)
	binary.BigEndian.PutUint32(huge[20:24], 20000)
	binary.BigEndian.PutUint32(huge[29:33], crc32.ChecksumIEEE(huge[12:29]))
	if _, err := NewTranscoder().ToWebP(context.Background(), huge, media.Bounds{}); !errors.Is(err, upload.ErrSmallFileTooLarge) {
		t.Fatalf("pixel bombs must be rejected before decoding, got %v", err)
	}
}
