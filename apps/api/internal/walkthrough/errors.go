package walkthrough

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(560101, "WALKTHROUGH_NOT_FOUND", apperror.KindNotFound)

var ErrNotOwner = apperror.Define(560102, "WALKTHROUGH_NOT_OWNER", apperror.KindPermissionDenied)

var ErrContentTooLong = apperror.Define(560103, "WALKTHROUGH_CONTENT_TOO_LONG", apperror.KindUnprocessable)

var ErrEmpty = apperror.Define(560104, "WALKTHROUGH_EMPTY", apperror.KindUnprocessable)

var ErrRouteIncomplete = apperror.Define(560105, "WALKTHROUGH_ROUTE_INCOMPLETE", apperror.KindUnprocessable)

var ErrAlreadyWritten = apperror.Define(560106, "WALKTHROUGH_ALREADY_WRITTEN", apperror.KindConflict)

var ErrFormatQuotaExhausted = apperror.Define(560107, "WALKTHROUGH_FORMAT_QUOTA_EXHAUSTED", apperror.KindRateLimited)

var ErrFormatFailed = apperror.Define(560108, "WALKTHROUGH_FORMAT_FAILED", apperror.KindUpstreamFailed)

var ErrFormatTaskNotFound = apperror.Define(560109, "WALKTHROUGH_FORMAT_TASK_NOT_FOUND", apperror.KindNotFound)

var errNoFormatter = errors.New("no model formats walkthroughs")

var errFormatAbandoned = errors.New("the formatting task stopped without a result")
