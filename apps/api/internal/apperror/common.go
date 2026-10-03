package apperror

var (
	ErrValidationFailed = Define(100101, "COMMON_VALIDATION_FAILED", KindUnprocessable)
	ErrNotImplemented   = Define(100102, "COMMON_NOT_IMPLEMENTED", KindNotImplemented)
)
