package walkthrough

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound       = apperror.Define(560101, "WALKTHROUGH_NOT_FOUND", apperror.KindNotFound)
	ErrNotOwner       = apperror.Define(560102, "WALKTHROUGH_NOT_OWNER", apperror.KindPermissionDenied)
	ErrContentTooLong = apperror.Define(560103, "WALKTHROUGH_CONTENT_TOO_LONG", apperror.KindUnprocessable)
)
