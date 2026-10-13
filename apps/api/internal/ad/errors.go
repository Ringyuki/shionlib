package ad

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(580101, "AD_NOT_FOUND", apperror.KindNotFound)
