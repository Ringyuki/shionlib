package download

import (
	"errors"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var (
	ErrResourceNotFound     = apperror.Define(440101, "GAME_DOWNLOAD_RESOURCE_NOT_FOUND", apperror.KindNotFound)
	ErrResourceNotOwner     = apperror.Define(440102, "GAME_DOWNLOAD_RESOURCE_NOT_OWNER", apperror.KindPermissionDenied)
	ErrSessionAlreadyUsed   = apperror.Define(440103, "GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED", apperror.KindConflict)
	ErrFileNotFound         = apperror.Define(450101, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND", apperror.KindNotFound)
	ErrTokenRequired        = apperror.Define(450102, "GAME_DOWNLOAD_RESOURCE_FILE_TOKEN_REQUIRED", apperror.KindInvalidArgument)
	ErrInvalidToken         = apperror.Define(450103, "GAME_DOWNLOAD_RESOURCE_FILE_INVALID_TOKEN", apperror.KindPermissionDenied)
	ErrFileNotOwner         = apperror.Define(450104, "GAME_DOWNLOAD_RESOURCE_FILE_NOT_OWNER", apperror.KindPermissionDenied)
	ErrLocalFileMissing     = errors.New("local upload file is missing")
	ErrFileNotReadyForStore = errors.New("file is not approved for object storage yet")
	ErrTicketSecretMissing  = errors.New("FILE_DOWNLOAD_TICKET_SECRET is required when FILE_DOWNLOAD_MODE=worker")
	ErrWorkerHostMissing    = errors.New("FILE_DOWNLOAD_PROXY_WORKER_HOST is required when FILE_DOWNLOAD_MODE=worker")
)
