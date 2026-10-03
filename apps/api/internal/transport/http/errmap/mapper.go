package errmap

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/requestid"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reqstate"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type ErrorData struct {
	Errors []apperror.FieldError `json:"errors"`
}

type ErrorResponse struct {
	status    int
	headers   http.Header
	cause     error
	Code      int        `json:"code"`
	Message   string     `json:"message"`
	Data      *ErrorData `json:"data"`
	RequestID string     `json:"requestId"`
	Timestamp time.Time  `json:"timestamp"`
}

func (e *ErrorResponse) GetStatus() int {
	return e.status
}

func (e *ErrorResponse) Error() string {
	if e.cause != nil {
		return e.cause.Error()
	}
	return e.Message
}

func (e *ErrorResponse) Unwrap() error {
	return e.cause
}

func (e *ErrorResponse) GetHeaders() http.Header {
	if e.headers == nil {
		e.headers = http.Header{}
	}
	return e.headers
}

type HeaderCarrier interface {
	ResponseHeaders() http.Header
}

type Mapper struct {
	builder *response.Builder
}

func NewMapper(builder *response.Builder) *Mapper {
	return &Mapper{builder: builder}
}

func (m *Mapper) Install() {
	huma.NewErrorWithContext = func(hctx huma.Context, status int, msg string, errs ...error) huma.StatusError {
		return m.FromHuma(hctx.Context(), status, msg, errs...)
	}
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		return m.FromHuma(context.Background(), status, msg, errs...)
	}
}

func (m *Mapper) FromHuma(ctx context.Context, status int, msg string, errs ...error) *ErrorResponse {
	for _, err := range errs {
		var existing *ErrorResponse
		if errors.As(err, &existing) {
			return existing
		}
	}
	for _, err := range errs {
		var withStatus *statusError
		if _, ok := apperror.From(err); ok || errors.As(err, &withStatus) {
			return m.FromError(ctx, err)
		}
	}
	switch status {
	case http.StatusUnprocessableEntity:
		fields := fieldErrors(ctx, m.builder.Translate, errs)
		return m.FromError(ctx, appValidation(fields))
	case http.StatusInternalServerError:
		var cause error
		if len(errs) > 0 {
			cause = errors.Join(errs...)
		} else {
			cause = errors.New(msg)
		}
		return m.FromError(ctx, cause)
	default:
		return m.FromStatus(ctx, status, errors.Join(errs...))
	}
}

func (m *Mapper) FromError(ctx context.Context, err error) *ErrorResponse {
	var existing *ErrorResponse
	if errors.As(err, &existing) {
		return existing
	}
	var withStatus *statusError
	if errors.As(err, &withStatus) {
		return m.FromStatus(ctx, withStatus.status, withStatus.cause)
	}
	appErr, ok := apperror.From(err)
	if !ok {
		result := m.build(ctx, http.StatusInternalServerError, http.StatusInternalServerError, "common.error", nil, nil, err)
		reqstate.RecordError(ctx, result.Code, err)
		return result
	}
	def := appErr.Definition()
	status := StatusOf(def.Kind())
	args := appErr.Args()
	fields := appErr.Fields()
	var data *ErrorData
	if len(fields) > 0 {
		data = &ErrorData{Errors: fields}
	}
	result := m.build(ctx, status, def.Code(), appErr.MessageKey(), args, data, err)
	var carrier HeaderCarrier
	if errors.As(err, &carrier) {
		for key, values := range carrier.ResponseHeaders() {
			for _, value := range values {
				result.GetHeaders().Add(key, value)
			}
		}
	}
	reqstate.RecordError(ctx, def.Code(), err)
	return result
}

func (m *Mapper) FromStatus(ctx context.Context, status int, cause error) *ErrorResponse {
	result := m.build(ctx, status, status, formatStatusMessage(status), nil, nil, cause)
	reqstate.RecordError(ctx, status, cause)
	return result
}

func (m *Mapper) build(ctx context.Context, status, code int, key string, args map[string]any, data *ErrorData, cause error) *ErrorResponse {
	return &ErrorResponse{
		status:    status,
		cause:     cause,
		Code:      code,
		Message:   m.builder.Translate(ctx, key, args),
		Data:      data,
		RequestID: requestid.From(ctx),
		Timestamp: m.builder.Now(),
	}
}

func appValidation(fields []apperror.FieldError) *apperror.Error {
	err := apperror.ErrValidationFailed.New()
	for _, field := range fields {
		err = err.WithField(field.Field, field.Messages...)
	}
	return err
}
