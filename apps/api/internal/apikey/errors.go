package apikey

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var ErrKeyRequired = apperror.Define(680101, "API_KEY_REQUIRED", apperror.KindUnauthenticated)

var ErrKeyInvalid = apperror.Define(680102, "API_KEY_INVALID", apperror.KindUnauthenticated)

var ErrKeySuspended = apperror.Define(680103, "API_KEY_SUSPENDED", apperror.KindPermissionDenied)

var ErrOwnerBanned = apperror.Define(680104, "API_KEY_OWNER_BANNED", apperror.KindPermissionDenied)

var ErrClosed = apperror.Define(680105, "API_KEYS_CLOSED", apperror.KindUnavailable)

var ErrTooManyKeys = apperror.Define(680106, "API_KEY_LIMIT_REACHED", apperror.KindConflict)

var ErrNotFound = apperror.Define(680107, "API_KEY_NOT_FOUND", apperror.KindNotFound)
