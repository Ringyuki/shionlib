package report

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrDuplicated = apperror.Define(440201, "GAME_DOWNLOAD_RESOURCE_REPORT_DUPLICATED", apperror.KindConflict)

var ErrSelfReport = apperror.Define(440202, "GAME_DOWNLOAD_RESOURCE_REPORT_SELF_NOT_ALLOWED", apperror.KindInvalidArgument)

var ErrNotFound = apperror.Define(440203, "GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND", apperror.KindNotFound)

var ErrAlreadyProcessed = apperror.Define(440204, "GAME_DOWNLOAD_RESOURCE_REPORT_ALREADY_PROCESSED", apperror.KindConflict)

var ErrSuspended = apperror.Define(440205, "GAME_DOWNLOAD_RESOURCE_REPORT_SUSPENDED", apperror.KindPermissionDenied)
