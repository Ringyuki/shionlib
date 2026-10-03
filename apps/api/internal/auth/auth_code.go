package auth

import (
	"time"
)

const DefaultCodeTTL = 10 * time.Minute

type VerificationCode struct {
	Email   string
	Code    string
	Created time.Time
}
