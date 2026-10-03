package download

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrResourceNotFound = apperror.Define(440101, "GAME_DOWNLOAD_RESOURCE_NOT_FOUND", apperror.KindNotFound)

var ErrResourceNotOwner = apperror.Define(440102, "GAME_DOWNLOAD_RESOURCE_NOT_OWNER", apperror.KindPermissionDenied)

var ErrSessionAlreadyUsed = apperror.Define(440103, "GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED", apperror.KindConflict)

var ErrFileNotFound = apperror.Define(450101, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND", apperror.KindNotFound)

var ErrTokenRequired = apperror.Define(450102, "GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED", apperror.KindInvalidArgument)

var ErrInvalidToken = apperror.Define(450103, "GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN", apperror.KindPermissionDenied)

var ErrFileNotOwner = apperror.Define(450104, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER", apperror.KindPermissionDenied)

var ErrLocalFileMissing = errors.New("local upload file is missing")

var ErrFileNotReadyForStore = errors.New("file is not approved for object storage yet")

var ErrTicketSecretMissing = errors.New("FILE_DOWNLOAD_TICKET_SECRET is required when FILE_DOWNLOAD_MODE=worker")

var ErrWorkerHostMissing = errors.New("FILE_DOWNLOAD_PROXY_WORKER_HOST is required when FILE_DOWNLOAD_MODE=worker")
