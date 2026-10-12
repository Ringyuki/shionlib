package scan

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrCaseNotFound = apperror.Define(440206, "GAME_DOWNLOAD_RESOURCE_MALWARE_CASE_NOT_FOUND", apperror.KindNotFound)

var ErrCaseAlreadyProcessed = apperror.Define(440207, "GAME_DOWNLOAD_RESOURCE_MALWARE_CASE_ALREADY_PROCESSED", apperror.KindConflict)

var ErrCheckNotStalled = apperror.Define(440208, "GAME_DOWNLOAD_RESOURCE_CHECK_NOT_STALLED", apperror.KindNotFound)

var ErrObjectMissing = errors.New("the stored object does not exist")
