package sponsor

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrOrderNotFound = apperror.Define(570101, "SPONSOR_ORDER_NOT_FOUND", apperror.KindNotFound)

var ErrOrderAlreadyPaid = apperror.Define(570102, "SPONSOR_ORDER_ALREADY_PAID", apperror.KindConflict)

var ErrOrderExpired = apperror.Define(570103, "SPONSOR_ORDER_EXPIRED", apperror.KindGone)

var ErrProviderRequestFailed = apperror.Define(570104, "SPONSOR_PROVIDER_REQUEST_FAILED", apperror.KindUpstreamFailed)

var ErrProviderVerificationFailed = apperror.Define(570105, "SPONSOR_PROVIDER_VERIFICATION_FAILED", apperror.KindUpstreamFailed)

var ErrDisabled = apperror.Define(570106, "SPONSOR_MODULE_DISABLED", apperror.KindUnavailable)
