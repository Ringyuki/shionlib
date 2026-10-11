package imaging

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"

	"github.com/gen2brain/avif"
	"github.com/gen2brain/webp"
	_ "golang.org/x/image/bmp"

	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
)

const (
	PreviewMaxPixels = 64_000_000
	previewQuality   = 85
)

func (p *Transcoder) Shrink(ctx context.Context, data []byte, longest int) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width*config.Height > PreviewMaxPixels {
		return nil, inspection.ErrUnreadableImage
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
		return nil, inspection.ErrUnreadableImage
	}
	normalized := toNRGBA(img)
	if format == "jpeg" {
		normalized = orient(normalized, jpegOrientation(data))
	}
	bounds := media.Bounds{}
	if normalized.Rect.Dx() > longest || normalized.Rect.Dy() > longest {
		bounds = media.Bounds{MaxWidth: longest, MaxHeight: longest}
	}
	var out bytes.Buffer
	if err := webp.Encode(&out, resize(normalized, bounds), webp.Options{Quality: previewQuality, Method: 4}); err != nil {
		return nil, fmt.Errorf("encode the preview as webp: %w", err)
	}
	return out.Bytes(), nil
}
