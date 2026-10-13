package setting

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var (
	ErrNotFound     = apperror.Define(640101, "SETTING_NOT_FOUND", apperror.KindNotFound)
	ErrInvalidValue = apperror.Define(640102, "SETTING_INVALID_VALUE", apperror.KindInvalidArgument)
)

var errMalformed = errors.New("malformed setting value")
