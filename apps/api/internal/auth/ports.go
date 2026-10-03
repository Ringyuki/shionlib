package auth

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type SessionRepository interface {
	CreateSession(ctx context.Context, in NewSession) (Session, error)
	LockSessionByPrefix(ctx context.Context, prefix string) (Session, bool, error)
	FindSessionByPrefix(ctx context.Context, prefix string) (Session, bool, error)
	MarkSessionRotated(ctx context.Context, id, replacedBy int, at time.Time) error
	MarkSessionReused(ctx context.Context, id int, at time.Time) error
	BlockFamily(ctx context.Context, familyID string, statuses []SessionStatus, reason string, at time.Time) error
	BlockUserFamily(ctx context.Context, userID int, familyID, reason string, at time.Time) error
	BlockUserSessions(ctx context.Context, userID int, reason string, at, liveSince time.Time) ([]LiveFamily, error)
	FamilyStartedAt(ctx context.Context, familyID string) (time.Time, bool, error)
	DeleteStaleSessions(ctx context.Context, expiredBefore time.Time) (int, error)
}

type PasskeyRepository interface {
	ActivePasskeys(ctx context.Context, userID int) ([]Passkey, error)
	FindActivePasskey(ctx context.Context, credentialID string) (Passkey, bool, error)
	CreatePasskey(ctx context.Context, in NewPasskey) (Passkey, error)
	RecordPasskeyUse(ctx context.Context, id int, use PasskeyUse) error
	RevokePasskey(ctx context.Context, id, userID int, at time.Time) (bool, error)
	CountActivePasskeys(ctx context.Context, userID int) (int, error)
}

type IdentityRepository interface {
	FindIdentity(ctx context.Context, provider, subject string) (Identity, bool, error)
	GetIdentity(ctx context.Context, id int) (Identity, bool, error)
	CreateIdentity(ctx context.Context, in NewIdentity) error
	TouchIdentity(ctx context.Context, id int, at time.Time) error
	ListIdentities(ctx context.Context, userID int) ([]Identity, error)
	CountIdentities(ctx context.Context, userID int) (int, error)
	DeleteIdentity(ctx context.Context, id int) error
}

type Accounts interface {
	Get(ctx context.Context, id int) (user.User, error)
	FindByIdentifier(ctx context.Context, identifier string) (user.User, bool, error)
	FindByEmail(ctx context.Context, email string) (user.User, bool, error)
	FindByEmailFold(ctx context.Context, email string) (user.User, bool, error)
	NameExists(ctx context.Context, name string) (bool, error)
	Create(ctx context.Context, in user.NewUser) (user.User, error)
	Update(ctx context.Context, id int, changes user.Changes) error
}

type SecretHasher interface {
	Hash(secret string) (string, error)
	Verify(hash, secret string) (bool, error)
}

type EphemeralStore interface {
	Put(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Get(ctx context.Context, key string) ([]byte, bool, error)
	Take(ctx context.Context, key string) ([]byte, bool, error)
}

type Mailer interface {
	SendVerificationCode(ctx context.Context, to, code string, ttl time.Duration) error
	SendPasswordReset(ctx context.Context, to, link string, ttl time.Duration) error
}

type PasskeyCeremony interface {
	BeginRegistration(owner PasskeyOwner, exclude []Passkey) (PasskeyChallenge, error)
	FinishRegistration(owner PasskeyOwner, state []byte, response json.RawMessage) (RegisteredPasskey, error)
	BeginLogin(owner *PasskeyOwner, allow []Passkey) (PasskeyChallenge, error)
	CredentialID(response json.RawMessage) (string, error)
	FinishLogin(state []byte, owner PasskeyOwner, credentials []Passkey, response json.RawMessage) (PasskeyAssertion, error)
}

type IdentityProvider interface {
	AuthorizeURL(req AuthorizeRequest) string
	Exchange(ctx context.Context, req CodeExchange) (IdentityClaims, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
