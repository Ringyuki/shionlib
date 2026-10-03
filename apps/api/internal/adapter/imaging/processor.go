package imaging

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/draw"
	_ "image/jpeg"
	_ "image/png"
	"math"

	"github.com/gen2brain/avif"
	"github.com/gen2brain/webp"
	xdraw "golang.org/x/image/draw"

	"github.com/Ringyuki/shionlib/apps/api/internal/media"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	MaxInputPixels = 16383 * 16383
	webpQuality    = 80
)

type Processor struct{}

func NewProcessor() *Processor {
	return &Processor{}
}

func (p *Processor) ToWebP(ctx context.Context, data []byte, bounds media.Bounds) (media.Encoded, error) {
	if err := ctx.Err(); err != nil {
		return media.Encoded{}, err
	}
	decoded, err := decode(data)
	if err != nil {
		return media.Encoded{}, err
	}
	img := resize(decoded, bounds)
	var out bytes.Buffer
	if err := webp.Encode(&out, img, webp.Options{Quality: webpQuality, Method: 4}); err != nil {
		return media.Encoded{}, fmt.Errorf("encode webp: %w", err)
	}
	return media.Encoded{Data: out.Bytes(), ContentType: "image/webp", Extension: ".webp"}, nil
}

func decode(data []byte) (*image.NRGBA, error) {
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, upload.ErrSmallFileUnsupported.Wrap(err)
	}
	if config.Width <= 0 || config.Height <= 0 {
		return nil, upload.ErrSmallFileUnsupported
	}
	if config.Width*config.Height > MaxInputPixels {
		return nil, upload.ErrSmallFileTooLarge
	}
	var img image.Image
	switch format {
	case "webp":
		img, err = webp.Decode(bytes.NewReader(data), webp.Options{AutoRotate: true})
	case "avif":
		img, err = avif.Decode(bytes.NewReader(data))
	default:
		img, _, err = image.Decode(bytes.NewReader(data))
	}
	if err != nil {
		return nil, upload.ErrSmallFileUnsupported.Wrap(err)
	}
	normalized := toNRGBA(img)
	if format == "jpeg" {
		normalized = orient(normalized, jpegOrientation(data))
	}
	return normalized, nil
}

func toNRGBA(img image.Image) *image.NRGBA {
	if nrgba, ok := img.(*image.NRGBA); ok && nrgba.Rect.Min == (image.Point{}) {
		return nrgba
	}
	b := img.Bounds()
	out := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(out, out.Bounds(), img, b.Min, draw.Src)
	return out
}

func resize(img *image.NRGBA, bounds media.Bounds) *image.NRGBA {
	width, height := target(img.Rect.Dx(), img.Rect.Dy(), bounds)
	if width == img.Rect.Dx() && height == img.Rect.Dy() {
		return img
	}
	out := image.NewNRGBA(image.Rect(0, 0, width, height))
	xdraw.CatmullRom.Scale(out, out.Bounds(), img, img.Bounds(), xdraw.Src, nil)
	return out
}

func target(width, height int, bounds media.Bounds) (int, int) {
	var scale float64
	switch {
	case bounds.MaxWidth > 0 && bounds.MaxHeight > 0:
		scale = math.Min(float64(bounds.MaxWidth)/float64(width), float64(bounds.MaxHeight)/float64(height))
	case bounds.MaxWidth > 0:
		scale = float64(bounds.MaxWidth) / float64(width)
	case bounds.MaxHeight > 0:
		scale = float64(bounds.MaxHeight) / float64(height)
	default:
		return width, height
	}
	return max(1, int(math.Round(float64(width)*scale))), max(1, int(math.Round(float64(height)*scale)))
}
