package media

import (
	"math"
	"slices"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	ProfileImageMaxBytes   = 5 << 20
	AdImageMaxBytes        = 15 << 20
	FriendLinkLogoMaxBytes = 5 << 20
	AdBannerRatio          = 6.0
	AdBannerMinWidth       = 1200
	AdSideImageMinHeight   = 80
	AdSideIconSize         = 128
	AdShapeTolerance       = 0.05
)

var acceptedContentTypes = []string{"image/jpeg", "image/png", "image/webp", "image/avif"}

func Accepts(contentType string) bool {
	return slices.Contains(acceptedContentTypes, contentType)
}

type Upload struct {
	ContentType string
	Data        []byte
}

type Bounds struct {
	MaxWidth  int
	MaxHeight int
}

type Encoded struct {
	Data        []byte
	ContentType string
	Extension   string
	Width       int
	Height      int
}

func Validate(file *Upload, maxBytes int) error {
	if file == nil || len(file.Data) == 0 {
		return upload.ErrSmallFileMissing
	}
	if !Accepts(file.ContentType) {
		return upload.ErrSmallFileUnsupported
	}
	if len(file.Data) > maxBytes {
		return upload.ErrSmallFileTooLarge
	}
	return nil
}

type kind struct {
	maxBytes int
	bounds   Bounds
	shape    func(width, height int) error
	key      func(id string) string
	metadata map[string]string
}

func avatar(userID int) kind {
	owner := strconv.Itoa(userID)
	return kind{
		maxBytes: ProfileImageMaxBytes,
		bounds:   Bounds{MaxWidth: 233, MaxHeight: 233},
		key:      func(id string) string { return "user/" + owner + "/avatar/" + id },
		metadata: map[string]string{"user_id": owner},
	}
}

func cover(userID int) kind {
	owner := strconv.Itoa(userID)
	return kind{
		maxBytes: ProfileImageMaxBytes,
		bounds:   Bounds{MaxWidth: 1500},
		key:      func(id string) string { return "user/" + owner + "/cover/" + id },
		metadata: map[string]string{"user_id": owner},
	}
}

func background(userID int) kind {
	owner := strconv.Itoa(userID)
	return kind{
		maxBytes: ProfileImageMaxBytes,
		bounds:   Bounds{MaxWidth: 2560},
		key:      func(id string) string { return "user/" + owner + "/background/" + id },
		metadata: map[string]string{"user_id": owner},
	}
}

func adBanner(uploaderID int) kind {
	return kind{
		maxBytes: AdImageMaxBytes,
		shape:    bannerShape,
		key:      func(id string) string { return "spotlight/banner/" + id },
		metadata: map[string]string{"uploader_id": strconv.Itoa(uploaderID)},
	}
}

func adSideImage(uploaderID int) kind {
	return kind{
		maxBytes: AdImageMaxBytes,
		shape:    sideImageShape,
		key:      func(id string) string { return "spotlight/side/" + id },
		metadata: map[string]string{"uploader_id": strconv.Itoa(uploaderID)},
	}
}

func adSideIcon(uploaderID int) kind {
	return kind{
		maxBytes: AdImageMaxBytes,
		bounds:   Bounds{MaxWidth: AdSideIconSize, MaxHeight: AdSideIconSize},
		shape:    sideIconShape,
		key:      func(id string) string { return "spotlight/icon/" + id },
		metadata: map[string]string{"uploader_id": strconv.Itoa(uploaderID)},
	}
}

func bannerShape(width, height int) error {
	ratio := float64(width) / float64(height)
	if width < AdBannerMinWidth || ratio < AdBannerRatio*(1-AdShapeTolerance) || ratio > AdBannerRatio*(1+AdShapeTolerance) {
		return upload.ErrAdBannerShape.WithArgs(map[string]any{"ratio": int(AdBannerRatio), "minWidth": AdBannerMinWidth, "width": width, "height": height})
	}
	return nil
}

func sideImageShape(_, height int) error {
	if height < AdSideImageMinHeight {
		return upload.ErrAdSideImageShape.WithArgs(map[string]any{"minHeight": AdSideImageMinHeight, "height": height})
	}
	return nil
}

func sideIconShape(width, height int) error {
	if math.Abs(float64(width-height)) > float64(max(width, height))*AdShapeTolerance {
		return upload.ErrAdSideIconShape.WithArgs(map[string]any{"width": width, "height": height})
	}
	return nil
}

func friendLinkLogo(uploaderID int) kind {
	return kind{
		maxBytes: FriendLinkLogoMaxBytes,
		bounds:   Bounds{MaxWidth: 256, MaxHeight: 256},
		key:      func(id string) string { return "friend-link/logo/" + id },
		metadata: map[string]string{"uploader_id": strconv.Itoa(uploaderID)},
	}
}
