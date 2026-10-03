package developer

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound       = apperror.Define(410101, "GAME_DEVELOPER_NOT_FOUND", apperror.KindNotFound)
	ErrAlreadyExists  = apperror.Define(410102, "GAME_DEVELOPER_ALREADY_EXISTS", apperror.KindConflict)
	ErrMinOneRequired = apperror.Define(410103, "GAME_DEVELOPER_MIN_ONE_REQUIRED", apperror.KindInvalidArgument)
	ErrHasRelations   = apperror.Define(410104, "GAME_DEVELOPER_HAS_RELATIONS", apperror.KindConflict)
	ErrHasChildren    = apperror.Define(410105, "GAME_DEVELOPER_HAS_CHILDREN", apperror.KindConflict)
)
