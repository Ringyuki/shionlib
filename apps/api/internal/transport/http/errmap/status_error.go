package errmap

import "fmt"

type statusError struct {
	status int
	cause  error
}

func WithStatus(status int, cause error) error {
	return &statusError{status: status, cause: cause}
}

func (e *statusError) Error() string {
	if e.cause == nil {
		return fmt.Sprintf("http status %d", e.status)
	}
	return e.cause.Error()
}

func (e *statusError) Unwrap() error {
	return e.cause
}
