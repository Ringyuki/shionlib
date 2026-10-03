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

const (
	DefaultReplayWait = 1200 * time.Millisecond
	DefaultReplayPoll = 20 * time.Millisecond
	SessionRetention  = 7 * 24 * time.Hour
	minFamilyBlockTTL = time.Second
)

type SessionPolicy struct {
	Version       string
	Pepper        string
	AccessTTL     time.Duration
	ShortWindow   time.Duration
	LongWindow    time.Duration
	RotationGrace time.Duration
	ReplayWait    time.Duration
	ReplayPoll    time.Duration
}

const TokenTypeAccess = "access"

type AccessClaims struct {
	UserID       int
	SessionID    int
	FamilyID     string
	Role         actor.Role
	ContentLimit actor.ContentLimit
	IssuedAt     time.Time
	ExpiresAt    time.Time
}

func (t refreshToken) format(version string) string {
	return version + "." + t.prefix + "." + t.opaque
}

const (
	reasonReuseDetected = "refresh_token_reuse_detected"
	reasonUserNotFound  = "user_not_found"
	reasonUserBanned    = "user_banned"
	reasonLogout        = "user_logout"
	reasonPasswordReset = "user_password_changed"
)

const (
	refreshOpaqueBytes = 32
	refreshPrefixChars = 16
)

type refreshToken struct {
	prefix string
	opaque string
}
