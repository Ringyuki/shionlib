package ai

import (
	"context"
	"errors"
	"strings"
)

type Failure struct {
	Kind    ErrorKind
	Message string
	Detail  string
	Param   string
}

func (f *Failure) Error() string {
	if f.Message == "" {
		return string(f.Kind)
	}
	return string(f.Kind) + ": " + f.Message
}

func failureOf(err error) *Failure {
	var failure *Failure
	if errors.As(err, &failure) {
		return failure
	}
	kind := ErrorOther
	if errors.Is(err, context.DeadlineExceeded) {
		kind = ErrorTimeout
	}
	message := err.Error()
	return &Failure{Kind: kind, Message: clip(message, maxErrorMessage), Detail: clip(message, maxErrorDetail)}
}

func clip(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}

func malformedOutput(completion Completion) *Failure {
	kind := ErrorMalformed
	if completion.FinishReason == FinishLength {
		kind = ErrorTruncated
	}
	return &Failure{
		Kind:    kind,
		Message: "finish_reason: " + string(completion.FinishReason),
		Detail:  clip(strings.TrimSpace(completion.Text), 8000),
	}
}
