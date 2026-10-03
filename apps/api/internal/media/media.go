package media

import (
	"slices"
	"strconv"

	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	ProfileImageMaxBytes = 5 << 20
	AdImageMaxBytes      = 15 << 20
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

func adImage(uploaderID int) kind {
	return kind{
		maxBytes: AdImageMaxBytes,
		key:      func(id string) string { return "ad/image/" + id },
		metadata: map[string]string{"uploader_id": strconv.Itoa(uploaderID)},
	}
}
