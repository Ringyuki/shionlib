package errmap

import (
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
)

var kindStatus = map[apperror.Kind]int{
	apperror.KindInternal:             http.StatusInternalServerError,
	apperror.KindInvalidArgument:      http.StatusBadRequest,
	apperror.KindUnprocessable:        http.StatusUnprocessableEntity,
	apperror.KindUnauthenticated:      http.StatusUnauthorized,
	apperror.KindPermissionDenied:     http.StatusForbidden,
	apperror.KindNotFound:             http.StatusNotFound,
	apperror.KindConflict:             http.StatusConflict,
	apperror.KindGone:                 http.StatusGone,
	apperror.KindPayloadTooLarge:      http.StatusRequestEntityTooLarge,
	apperror.KindUnsupportedMediaType: http.StatusUnsupportedMediaType,
	apperror.KindRateLimited:          http.StatusTooManyRequests,
	apperror.KindUpstreamFailed:       http.StatusBadGateway,
	apperror.KindUnavailable:          http.StatusServiceUnavailable,
	apperror.KindNotImplemented:       http.StatusNotImplemented,
}

func StatusOf(kind apperror.Kind) int {
	if status, ok := kindStatus[kind]; ok {
		return status
	}
	return http.StatusInternalServerError
}
