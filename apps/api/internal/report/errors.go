package report

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrDuplicated       = apperror.Define(440201, "GAME_DOWNLOAD_RESOURCE_REPORT_DUPLICATED", apperror.KindConflict)
	ErrSelfReport       = apperror.Define(440202, "GAME_DOWNLOAD_RESOURCE_REPORT_SELF_NOT_ALLOWED", apperror.KindInvalidArgument)
	ErrNotFound         = apperror.Define(440203, "GAME_DOWNLOAD_RESOURCE_REPORT_NOT_FOUND", apperror.KindNotFound)
	ErrAlreadyProcessed = apperror.Define(440204, "GAME_DOWNLOAD_RESOURCE_REPORT_ALREADY_PROCESSED", apperror.KindConflict)
	ErrSuspended        = apperror.Define(440205, "GAME_DOWNLOAD_RESOURCE_REPORT_SUSPENDED", apperror.KindPermissionDenied)
)
