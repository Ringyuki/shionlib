package download

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrResourceNotFound = apperror.Define(440101, "GAME_DOWNLOAD_RESOURCE_NOT_FOUND", apperror.KindNotFound)

var ErrResourceNotOwner = apperror.Define(440102, "GAME_DOWNLOAD_RESOURCE_NOT_OWNER", apperror.KindPermissionDenied)

var ErrSessionAlreadyUsed = apperror.Define(440103, "GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED", apperror.KindConflict)

var ErrTooManyFiles = apperror.Define(440104, "GAME_DOWNLOAD_RESOURCE_TOO_MANY_FILES", apperror.KindInvalidArgument)

var ErrLastFile = apperror.Define(440105, "GAME_DOWNLOAD_RESOURCE_LAST_FILE", apperror.KindConflict)

var ErrDuplicateFileName = apperror.Define(440106, "GAME_DOWNLOAD_RESOURCE_DUPLICATE_FILE_NAME", apperror.KindConflict)

var ErrFileNotFound = apperror.Define(450101, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND", apperror.KindNotFound)

var ErrTokenRequired = apperror.Define(450102, "GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED", apperror.KindInvalidArgument)

var ErrInvalidToken = apperror.Define(450103, "GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN", apperror.KindPermissionDenied)

var ErrFileNotOwner = apperror.Define(450104, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER", apperror.KindPermissionDenied)

var ErrFileUnderReview = apperror.Define(450105, "GAME_DOWNLOAD_RESOURCE_FILE_UNDER_REVIEW", apperror.KindConflict)

var ErrLocalFileMissing = errors.New("local upload file is missing")

var ErrFileNotReadyForStore = errors.New("file is not approved for object storage yet")

var ErrTicketSecretMissing = errors.New("FILE_DOWNLOAD_TICKET_SECRET is required when FILE_DOWNLOAD_MODE=worker")

var ErrWorkerHostMissing = errors.New("FILE_DOWNLOAD_PROXY_WORKER_HOST is required when FILE_DOWNLOAD_MODE=worker")
