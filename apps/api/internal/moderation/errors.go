package moderation

import (
	"errors"
)

var ErrSubjectNotFound = errors.New("moderation subject not found")

var ErrClassifierDisabled = errors.New("moderation classifier is not configured")
