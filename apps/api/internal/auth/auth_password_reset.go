package auth

import (
	"time"
)

const (
	PasswordResetTTL  = 10 * time.Minute
	passwordResetPath = "/user/password/forget"
)

type PasswordReset struct {
	Token string
	Email string
}

func (r PasswordReset) matches(token, email string) bool {
	return r.Token == token && r.Email == email
}
