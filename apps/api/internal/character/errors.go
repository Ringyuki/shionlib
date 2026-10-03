package character

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrNotFound       = apperror.Define(420101, "GAME_CHARACTER_NOT_FOUND", apperror.KindNotFound)
	ErrAlreadyExists  = apperror.Define(420102, "GAME_CHARACTER_ALREADY_EXISTS", apperror.KindConflict)
	ErrMinOneRequired = apperror.Define(420103, "GAME_CHARACTER_MIN_ONE_REQUIRED", apperror.KindInvalidArgument)
	ErrHasRelations   = apperror.Define(420104, "GAME_CHARACTER_HAS_RELATIONS", apperror.KindConflict)
)
