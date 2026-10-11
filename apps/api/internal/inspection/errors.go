package inspection

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(650101, "INSPECTION_NOT_FOUND", apperror.KindNotFound)

var ErrEntryNotFound = apperror.Define(650102, "INSPECTION_ENTRY_NOT_FOUND", apperror.KindNotFound)

var ErrNoPreview = apperror.Define(650103, "INSPECTION_ENTRY_NO_PREVIEW", apperror.KindNotFound)

var ErrUnreadableImage = errors.New("the image cannot be decoded")

var ErrResourceGone = errors.New("the resource of the inspection no longer exists")
