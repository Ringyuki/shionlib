package game

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound                 = apperror.Define(400101, "GAME_NOT_FOUND", apperror.KindNotFound)
	ErrInvalidVNDBID            = apperror.Define(400102, "GAME_INVALID_VNDB_ID", apperror.KindUnprocessable)
	ErrBangumiRequestFailed     = apperror.Define(400103, "GAME_BANGUMI_REQUEST_FAILED", apperror.KindInvalidArgument)
	ErrVNDBRequestFailed        = apperror.Define(400104, "GAME_VNDB_REQUEST_FAILED", apperror.KindInvalidArgument)
	ErrAlreadyExists            = apperror.Define(400105, "GAME_ALREADY_EXISTS", apperror.KindConflict)
	ErrDataConsistencyCheck     = apperror.Define(400106, "GAME_DATA_CONSISTENCY_CHECK_FAILED", apperror.KindInvalidArgument)
	ErrMissingBangumiOrVNDBID   = apperror.Define(400107, "GAME_MISSING_BANGUMI_OR_VNDB_ID", apperror.KindInvalidArgument)
	ErrEntryMaintainedByCatalog = apperror.Define(400108, "GAME_ENTRY_MIRRORED", apperror.KindPermissionDenied)
)
