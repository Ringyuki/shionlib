package imaging

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"testing"

	"github.com/gen2brain/webp"
	"golang.org/x/image/bmp"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

func shrunk(t *testing.T, data []byte, longest int) image.Image {
	t.Helper()
	out, err := NewTranscoder().Shrink(context.Background(), data, longest)
	if err != nil {
		t.Fatal(err)
	}
	img, err := webp.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	return img
}

func TestShrinkFitsTheLongerSideAndLeavesSmallImagesAtTheirSize(t *testing.T) {
	data := encodePNG(t, sample(400, 300))
	if got := shrunk(t, data, 200).Bounds(); got.Dx() != 200 || got.Dy() != 150 {
		t.Fatalf("wide image: got %dx%d", got.Dx(), got.Dy())
	}
	if got := shrunk(t, encodePNG(t, sample(300, 400)), 200).Bounds(); got.Dx() != 150 || got.Dy() != 200 {
		t.Fatalf("tall image: got %dx%d", got.Dx(), got.Dy())
	}
	if got := shrunk(t, data, 400).Bounds(); got.Dx() != 400 || got.Dy() != 300 {
		t.Fatalf("an image within the limit keeps its size: got %dx%d", got.Dx(), got.Dy())
	}
}

func TestShrinkReadsTheFormatsThatArePreviewed(t *testing.T) {
	img := sample(40, 20)
	var jpegData, gifData, bmpData, webpData bytes.Buffer
	if err := jpeg.Encode(&jpegData, img, nil); err != nil {
		t.Fatal(err)
	}
	if err := gif.Encode(&gifData, img, nil); err != nil {
		t.Fatal(err)
	}
	if err := bmp.Encode(&bmpData, img); err != nil {
		t.Fatal(err)
	}
	if err := webp.Encode(&webpData, img, webp.Options{Quality: 80}); err != nil {
		t.Fatal(err)
	}
	for name, data := range map[string][]byte{"png": encodePNG(t, img), "jpeg": jpegData.Bytes(), "gif": gifData.Bytes(), "bmp": bmpData.Bytes(), "webp": webpData.Bytes()} {
		if got := shrunk(t, data, 4096).Bounds(); got.Dx() != 40 || got.Dy() != 20 {
			t.Fatalf("%s: got %dx%d", name, got.Dx(), got.Dy())
		}
	}
}

func TestShrinkRefusesWhatIsNotAnImage(t *testing.T) {
	huge := image.NewPaletted(image.Rect(0, 0, 9000, 8000), color.Palette{color.Black})
	var oversized bytes.Buffer
	if err := gif.Encode(&oversized, huge, nil); err != nil {
		t.Fatal(err)
	}
	truncated := encodePNG(t, sample(40, 20))
	for name, data := range map[string][]byte{
		"a web page":                    []byte("<html><script>alert(1)</script></html>"),
		"an svg":                        []byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`),
		"nothing":                       nil,
		"an image with too many pixels": oversized.Bytes(),
		"a truncated image":             truncated[:len(truncated)/2],
	} {
		if _, err := NewTranscoder().Shrink(context.Background(), data, 4096); !errors.Is(err, inspection.ErrUnreadableImage) {
			t.Fatalf("%s: %v", name, err)
		}
	}
}

func TestShrinkStopsWhenTheRequestIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := NewTranscoder().Shrink(ctx, encodePNG(t, sample(4, 4)), 4096); !errors.Is(err, context.Canceled) {
		t.Fatalf("shrink: %v", err)
	}
}
