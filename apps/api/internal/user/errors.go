package user

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrNotFound = apperror.Define(300101, "USER_NOT_FOUND", apperror.KindNotFound)

var ErrEmailAlreadyExists = apperror.Define(300102, "USER_EMAIL_ALREADY_EXISTS", apperror.KindConflict)

var ErrNameAlreadyExists = apperror.Define(300103, "USER_NAME_ALREADY_EXISTS", apperror.KindConflict)

var ErrNotAllowRegister = apperror.Define(300104, "USER_NOT_ALLOW_REGISTER", apperror.KindPermissionDenied)

var ErrBanned = apperror.Define(300105, "USER_BANNED", apperror.KindPermissionDenied)

var ErrInvalidPassword = apperror.Define(300106, "USER_INVALID_PASSWORD", apperror.KindUnauthenticated)

var ErrInvalidLang = apperror.Define(300107, "USER_INVALID_LANG", apperror.KindUnprocessable)

var ErrInvalidContentLimit = apperror.Define(300108, "USER_INVALID_CONTENT_LIMIT", apperror.KindUnprocessable)

var ErrAlreadyBanned = apperror.Define(300109, "USER_ALREADY_BANNED", apperror.KindConflict)

var ErrAlreadyUnbanned = apperror.Define(300110, "USER_ALREADY_UNBANNED", apperror.KindConflict)

var ErrInvalidBanDuration = apperror.Define(300111, "USER_INVALID_BAN_DURATION", apperror.KindUnprocessable)
