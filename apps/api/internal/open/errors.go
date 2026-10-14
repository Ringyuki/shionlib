package open

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var ErrOneKind = apperror.Define(690101, "OPEN_LOOKUP_ONE_KIND", apperror.KindUnprocessable)

var ErrTooManyValues = apperror.Define(690102, "OPEN_LOOKUP_TOO_MANY", apperror.KindUnprocessable)

var ErrBadValue = apperror.Define(690103, "OPEN_LOOKUP_BAD_VALUE", apperror.KindUnprocessable)
