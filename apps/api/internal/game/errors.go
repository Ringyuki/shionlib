package game

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound             = apperror.Define(400101, "GAME_NOT_FOUND", apperror.KindNotFound)
	ErrBangumiRequestFailed = apperror.Define(400103, "GAME_BANGUMI_REQUEST_FAILED", apperror.KindInvalidArgument)
	ErrVNDBRequestFailed    = apperror.Define(400104, "GAME_VNDB_REQUEST_FAILED", apperror.KindInvalidArgument)
	ErrAlreadyExists        = apperror.Define(400105, "GAME_ALREADY_EXISTS", apperror.KindConflict)
)
