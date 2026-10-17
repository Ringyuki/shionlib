package moyu

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrRequestFailed = apperror.Define(610102, "MOYU_REQUEST_FAILED", apperror.KindUpstreamFailed)

var ErrAddressUnrecognized = apperror.Define(610103, "MOYU_ADDRESS_UNRECOGNIZED", apperror.KindUnprocessable)

var ErrPageNotFound = apperror.Define(610104, "MOYU_PAGE_NOT_FOUND", apperror.KindUnprocessable)
