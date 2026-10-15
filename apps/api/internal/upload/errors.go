package upload

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var ErrInvalidTotalSize = apperror.Define(480101, "GAME_UPLOAD_INVALID_TOTAL_SIZE", apperror.KindInvalidArgument)

var ErrTooManyChunks = apperror.Define(480102, "GAME_UPLOAD_TOO_MANY_CHUNKS", apperror.KindInvalidArgument)

var ErrTooLarge = apperror.Define(480103, "GAME_UPLOAD_TOO_LARGE", apperror.KindInvalidArgument)

var ErrSessionNotFound = apperror.Define(480104, "GAME_UPLOAD_SESSION_NOT_FOUND", apperror.KindNotFound)

var ErrInvalidSessionStatus = apperror.Define(480105, "GAME_UPLOAD_INVALID_SESSION_STATUS", apperror.KindConflict)

var ErrUnexpectedLength = apperror.Define(480106, "GAME_UPLOAD_UNEXPECTED_CONTENT_LENGTH", apperror.KindInvalidArgument)

var ErrInvalidChunkSHA256 = apperror.Define(480107, "GAME_UPLOAD_INVALID_CHUNK_SHA256", apperror.KindConflict)

var ErrChunkSHA256Mismatch = apperror.Define(480108, "GAME_UPLOAD_CHUNK_SHA256_MISMATCH", apperror.KindConflict)

var ErrIncomplete = apperror.Define(480109, "GAME_UPLOAD_INCOMPLETE", apperror.KindConflict)

var ErrFileBLAKE3Mismatch = apperror.Define(480110, "GAME_UPLOAD_FILE_BLAKE3_MISMATCH", apperror.KindConflict)

var ErrInvalidChunkIndex = apperror.Define(480111, "GAME_UPLOAD_INVALID_CHUNK_INDEX", apperror.KindInvalidArgument)

var ErrSessionExpired = apperror.Define(480112, "GAME_UPLOAD_SESSION_EXPIRED", apperror.KindGone)

var ErrSessionNotOwner = apperror.Define(480113, "GAME_UPLOAD_SESSION_NOT_OWNER", apperror.KindPermissionDenied)

var ErrSessionAlreadyUsed = apperror.Define(480114, "GAME_UPLOAD_SESSION_ALREADY_USED", apperror.KindConflict)

var ErrInvalidFileStatus = apperror.Define(480115, "GAME_UPLOAD_INVALID_FILE_STATUS", apperror.KindConflict)

var ErrInvalidChunkSize = apperror.Define(480116, "GAME_UPLOAD_INVALID_CHUNK_SIZE", apperror.KindInvalidArgument)

var ErrHeldElsewhere = apperror.Define(480117, "GAME_UPLOAD_SESSION_HELD_ELSEWHERE", apperror.KindConflict)

var ErrFailureNotFound = apperror.Define(480118, "GAME_UPLOAD_FAILURE_NOT_FOUND", apperror.KindNotFound)

var ErrSmallFileTooLarge = apperror.Define(490101, "SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT", apperror.KindPayloadTooLarge)

var ErrSmallFileMissing = apperror.Define(490102, "SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED", apperror.KindInvalidArgument)

var ErrSmallFileUnsupported = apperror.Define(490103, "SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE", apperror.KindUnsupportedMediaType)

var ErrAdBannerShape = apperror.Define(490104, "SMALL_FILE_UPLOAD_AD_BANNER_SHAPE", apperror.KindInvalidArgument)

var ErrAdSideImageShape = apperror.Define(490105, "SMALL_FILE_UPLOAD_AD_SIDE_IMAGE_SHAPE", apperror.KindInvalidArgument)

var ErrAdSideIconShape = apperror.Define(490106, "SMALL_FILE_UPLOAD_AD_SIDE_ICON_SHAPE", apperror.KindInvalidArgument)

var ErrQuotaExceeded = apperror.Define(500102, "USER_UPLOAD_QUOTA_EXCEEDED", apperror.KindConflict)

var ErrInFlightExceeded = apperror.Define(500105, "USER_UPLOAD_IN_FLIGHT_EXCEEDED", apperror.KindConflict)

var ErrSpoolFull = apperror.Define(500106, "UPLOAD_SPOOL_FULL", apperror.KindUnavailable)
