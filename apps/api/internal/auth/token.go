package auth

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
)

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

type AccessTokenCodec interface {
	Sign(claims AccessClaims) (string, error)
	Verify(token string) (AccessClaims, error)
}

type FamilyBlocklist interface {
	Blocked(ctx context.Context, familyID string) (bool, error)
	Block(ctx context.Context, familyID string, ttl time.Duration) error
}
