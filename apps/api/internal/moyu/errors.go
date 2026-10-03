package moyu

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrPatchNotFound = apperror.Define(610101, "MOYU_PATCH_NOT_FOUND", apperror.KindNotFound)

var ErrRequestFailed = apperror.Define(610102, "MOYU_REQUEST_FAILED", apperror.KindUpstreamFailed)
