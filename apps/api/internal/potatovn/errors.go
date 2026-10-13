package potatovn

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrBindingNotFound = apperror.Define(540101, "PVN_BINDING_NOT_FOUND", apperror.KindNotFound)

var ErrBindingAlreadyExists = apperror.Define(540102, "PVN_BINDING_ALREADY_EXISTS", apperror.KindConflict)

var ErrBindingAuthFailed = apperror.Define(540103, "PVN_BINDING_AUTH_FAILED", apperror.KindUnauthenticated)

var ErrRequestFailed = apperror.Define(540104, "PVN_REQUEST_FAILED", apperror.KindUpstreamFailed)

var ErrMappingNotFound = apperror.Define(550101, "PVN_GAME_MAPPING_NOT_FOUND", apperror.KindNotFound)

var ErrMappingConflict = apperror.Define(550102, "PVN_GAME_MAPPING_CONFLICT", apperror.KindConflict)

var ErrRemoteGalgameMissing = errors.New("potatovn galgame no longer exists")
