package walkthrough

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(560101, "WALKTHROUGH_NOT_FOUND", apperror.KindNotFound)

var ErrNotOwner = apperror.Define(560102, "WALKTHROUGH_NOT_OWNER", apperror.KindPermissionDenied)

var ErrContentTooLong = apperror.Define(560103, "WALKTHROUGH_CONTENT_TOO_LONG", apperror.KindUnprocessable)

var ErrEmpty = apperror.Define(560104, "WALKTHROUGH_EMPTY", apperror.KindUnprocessable)

var ErrRouteIncomplete = apperror.Define(560105, "WALKTHROUGH_ROUTE_INCOMPLETE", apperror.KindUnprocessable)

var ErrAlreadyWritten = apperror.Define(560106, "WALKTHROUGH_ALREADY_WRITTEN", apperror.KindConflict)
