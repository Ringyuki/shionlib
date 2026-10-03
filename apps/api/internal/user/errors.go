package user

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound            = apperror.Define(300101, "USER_NOT_FOUND", apperror.KindNotFound)
	ErrEmailAlreadyExists  = apperror.Define(300102, "USER_EMAIL_ALREADY_EXISTS", apperror.KindConflict)
	ErrNameAlreadyExists   = apperror.Define(300103, "USER_NAME_ALREADY_EXISTS", apperror.KindConflict)
	ErrNotAllowRegister    = apperror.Define(300104, "USER_NOT_ALLOW_REGISTER", apperror.KindPermissionDenied)
	ErrBanned              = apperror.Define(300105, "USER_BANNED", apperror.KindPermissionDenied)
	ErrInvalidPassword     = apperror.Define(300106, "USER_INVALID_PASSWORD", apperror.KindUnauthenticated)
	ErrInvalidLang         = apperror.Define(300107, "USER_INVALID_LANG", apperror.KindUnprocessable)
	ErrInvalidContentLimit = apperror.Define(300108, "USER_INVALID_CONTENT_LIMIT", apperror.KindUnprocessable)
	ErrAlreadyBanned       = apperror.Define(300109, "USER_ALREADY_BANNED", apperror.KindConflict)
	ErrAlreadyUnbanned     = apperror.Define(300110, "USER_ALREADY_UNBANNED", apperror.KindConflict)
	ErrInvalidBanDuration  = apperror.Define(300111, "USER_INVALID_BAN_DURATION", apperror.KindUnprocessable)
)
