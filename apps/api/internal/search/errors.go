package search

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrImageMissing = apperror.Define(700101, "SEARCH_IMAGE_MISSING", apperror.KindInvalidArgument)

var ErrImageTooLarge = apperror.Define(700102, "SEARCH_IMAGE_TOO_LARGE", apperror.KindPayloadTooLarge)

var ErrImageUnsupported = apperror.Define(700103, "SEARCH_IMAGE_UNSUPPORTED", apperror.KindUnsupportedMediaType)

var ErrImageBusy = apperror.Define(700104, "SEARCH_IMAGE_BUSY", apperror.KindUnavailable)

var ErrImageFailed = apperror.Define(700105, "SEARCH_IMAGE_FAILED", apperror.KindUpstreamFailed)
