package message

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound  = apperror.Define(530101, "MESSAGE_NOT_FOUND", apperror.KindNotFound)
	ErrForbidden = apperror.Define(530102, "MESSAGE_FORBIDDEN", apperror.KindPermissionDenied)
)
