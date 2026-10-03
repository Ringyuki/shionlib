package favorite

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrAlreadyExists         = apperror.Define(460101, "FAVORITE_ALREADY_EXISTS", apperror.KindConflict)
	ErrItemAlreadyExists     = apperror.Define(460102, "FAVORITE_ITEM_ALREADY_EXISTS", apperror.KindConflict)
	ErrNotFound              = apperror.Define(460103, "FAVORITE_NOT_FOUND", apperror.KindNotFound)
	ErrItemNotFound          = apperror.Define(460104, "FAVORITE_ITEM_NOT_FOUND", apperror.KindNotFound)
	ErrItemNotOwner          = apperror.Define(460105, "FAVORITE_ITEM_NOT_OWNER", apperror.KindPermissionDenied)
	ErrNotOwner              = apperror.Define(460106, "FAVORITE_NOT_OWNER", apperror.KindPermissionDenied)
	ErrNameAlreadyExists     = apperror.Define(460107, "FAVORITE_NAME_ALREADY_EXISTS", apperror.KindConflict)
	ErrNotAllowView          = apperror.Define(460108, "FAVORITE_NOT_ALLOW_VIEW", apperror.KindPermissionDenied)
	ErrDefaultNotAllowDelete = apperror.Define(460109, "FAVORITE_DEFAULT_NOT_ALLOW_DELETE", apperror.KindConflict)
)
