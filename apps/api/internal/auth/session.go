package auth

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type SessionStatus int

const (
	SessionActive  SessionStatus = 1
	SessionRotated SessionStatus = 2
	SessionReused  SessionStatus = 3
	SessionBlocked SessionStatus = 4
)

const (
	reasonReuseDetected = "refresh_token_reuse_detected"
	reasonUserNotFound  = "user_not_found"
	reasonUserBanned    = "user_banned"
	reasonLogout        = "user_logout"
	reasonPasswordReset = "user_password_changed"
)

type Device struct {
	IP        string
	UserAgent string
}

type Session struct {
	ID          int
	UserID      int
	RefreshHash string
	Prefix      string
	Status      SessionStatus
	FamilyID    string
	ExpiresAt   time.Time
	Created     time.Time
}

type NewSession struct {
	UserID      int
	RefreshHash string
	Prefix      string
	FamilyID    string
	ExpiresAt   time.Time
	LastUsedAt  time.Time
	IP          *string
	UserAgent   *string
}

type LiveFamily struct {
	FamilyID  string
	Created   time.Time
	ExpiresAt time.Time
}

type Principal struct {
	UserID       int
	Role         actor.Role
	ContentLimit actor.ContentLimit
}

func PrincipalOf(u user.User) Principal {
	return Principal{UserID: u.ID, Role: u.Role, ContentLimit: u.ContentLimit}
}

type Tokens struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
	SessionID        int
	FamilyID         string
}
