package upload

import "github.com/Ringyuki/shionlib/apps/api/internal/apperror"

var (
	ErrInvalidTotalSize        = apperror.Define(480101, "GAME_UPLOAD_INVALID_TOTAL_SIZE", apperror.KindInvalidArgument)
	ErrTooManyChunks           = apperror.Define(480102, "GAME_UPLOAD_TOO_MANY_CHUNKS", apperror.KindInvalidArgument)
	ErrTooLarge                = apperror.Define(480103, "GAME_UPLOAD_TOO_LARGE", apperror.KindInvalidArgument)
	ErrSessionNotFound         = apperror.Define(480104, "GAME_UPLOAD_SESSION_NOT_FOUND", apperror.KindNotFound)
	ErrInvalidSessionStatus    = apperror.Define(480105, "GAME_UPLOAD_INVALID_SESSION_STATUS", apperror.KindConflict)
	ErrUnexpectedLength        = apperror.Define(480106, "GAME_UPLOAD_UNEXPECTED_CONTENT_LENGTH", apperror.KindInvalidArgument)
	ErrInvalidChunkSHA256      = apperror.Define(480107, "GAME_UPLOAD_INVALID_CHUNK_SHA256", apperror.KindConflict)
	ErrChunkSHA256Mismatch     = apperror.Define(480108, "GAME_UPLOAD_CHUNK_SHA256_MISMATCH", apperror.KindConflict)
	ErrIncomplete              = apperror.Define(480109, "GAME_UPLOAD_INCOMPLETE", apperror.KindConflict)
	ErrFileBLAKE3Mismatch      = apperror.Define(480110, "GAME_UPLOAD_FILE_BLAKE3_MISMATCH", apperror.KindConflict)
	ErrInvalidChunkIndex       = apperror.Define(480111, "GAME_UPLOAD_INVALID_CHUNK_INDEX", apperror.KindInvalidArgument)
	ErrSessionExpired          = apperror.Define(480112, "GAME_UPLOAD_SESSION_EXPIRED", apperror.KindGone)
	ErrSessionNotOwner         = apperror.Define(480113, "GAME_UPLOAD_SESSION_NOT_OWNER", apperror.KindPermissionDenied)
	ErrSessionAlreadyUsed      = apperror.Define(480114, "GAME_UPLOAD_SESSION_ALREADY_USED", apperror.KindConflict)
	ErrInvalidFileStatus       = apperror.Define(480115, "GAME_UPLOAD_INVALID_FILE_STATUS", apperror.KindConflict)
	ErrInvalidChunkSize        = apperror.Define(480116, "GAME_UPLOAD_INVALID_CHUNK_SIZE", apperror.KindInvalidArgument)
	ErrSmallFileTooLarge       = apperror.Define(490101, "SMALL_FILE_UPLOAD_FILE_SIZE_EXCEEDS_LIMIT", apperror.KindPayloadTooLarge)
	ErrSmallFileMissing        = apperror.Define(490102, "SMALL_FILE_UPLOAD_FILE_NO_FILE_PROVIDED", apperror.KindInvalidArgument)
	ErrSmallFileUnsupported    = apperror.Define(490103, "SMALL_FILE_UPLOAD_UNSUPPORTED_FILE_TYPE", apperror.KindUnsupportedMediaType)
	ErrQuotaNotFound           = apperror.Define(500101, "USER_UPLOAD_QUOTA_NOT_FOUND", apperror.KindNotFound)
	ErrQuotaExceeded           = apperror.Define(500102, "USER_UPLOAD_QUOTA_EXCEEDED", apperror.KindConflict)
	ErrQuotaUsedCantBeNegative = apperror.Define(500103, "USER_UPLOAD_QUOTA_USE_CANT_BE_NEGATIVE", apperror.KindConflict)
	ErrQuotaRecordNotFound     = apperror.Define(500104, "USER_UPLOAD_QUOTA_RECORD_NOT_FOUND", apperror.KindNotFound)
)
