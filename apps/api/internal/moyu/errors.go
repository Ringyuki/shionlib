package moyu

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrRequestFailed = apperror.Define(610102, "MOYU_REQUEST_FAILED", apperror.KindUpstreamFailed)
