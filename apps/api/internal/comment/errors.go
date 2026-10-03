package comment

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(470101, "COMMENT_NOT_FOUND", apperror.KindNotFound)

var ErrNotOwner = apperror.Define(470102, "COMMENT_NOT_OWNER", apperror.KindPermissionDenied)

var ErrTooDeep = apperror.Define(470103, "COMMENT_TOO_DEEP", apperror.KindInvalidArgument)

var ErrContentTooLong = apperror.Define(470104, "COMMENT_CONTENT_TOO_LONG", apperror.KindUnprocessable)
