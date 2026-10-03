package analysis

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrTrafficDetailUnavailable = apperror.Define(590101, "ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE", apperror.KindUpstreamFailed)

var ErrNotConfigured = errors.New("cloudflare analytics is not configured")
