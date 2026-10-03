package favorite

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrAlreadyExists = apperror.Define(460101, "FAVORITE_ALREADY_EXISTS", apperror.KindConflict)

var ErrItemAlreadyExists = apperror.Define(460102, "FAVORITE_ITEM_ALREADY_EXISTS", apperror.KindConflict)

var ErrNotFound = apperror.Define(460103, "FAVORITE_NOT_FOUND", apperror.KindNotFound)

var ErrItemNotFound = apperror.Define(460104, "FAVORITE_ITEM_NOT_FOUND", apperror.KindNotFound)

var ErrItemNotOwner = apperror.Define(460105, "FAVORITE_ITEM_NOT_OWNER", apperror.KindPermissionDenied)

var ErrNotOwner = apperror.Define(460106, "FAVORITE_NOT_OWNER", apperror.KindPermissionDenied)

var ErrNameAlreadyExists = apperror.Define(460107, "FAVORITE_NAME_ALREADY_EXISTS", apperror.KindConflict)

var ErrNotAllowView = apperror.Define(460108, "FAVORITE_NOT_ALLOW_VIEW", apperror.KindPermissionDenied)

var ErrDefaultNotAllowDelete = apperror.Define(460109, "FAVORITE_DEFAULT_NOT_ALLOW_DELETE", apperror.KindConflict)
