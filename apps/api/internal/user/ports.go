package user

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/media"
)

type Repository interface {
	Get(ctx context.Context, id int) (User, error)
	Lock(ctx context.Context, id int) (User, error)
	FindByEmail(ctx context.Context, email string) (User, bool, error)
	NameExists(ctx context.Context, name string) (bool, error)
	Create(ctx context.Context, in NewUser) (User, error)
	Update(ctx context.Context, id int, changes Changes) error
	Stats(ctx context.Context, id int) (Stats, error)
	CreateBan(ctx context.Context, in NewBan) error
	CloseLatestBan(ctx context.Context, userID int, at time.Time) error
	ActiveBans(ctx context.Context) ([]Ban, error)
	DeleteComments(ctx context.Context, userID int) error
}

type EditRecordStore interface {
	ListByActor(ctx context.Context, actorID int, viewer actor.Actor, page Page) ([]EditRecord, int, error)
}

type VerificationCodes interface {
	Request(ctx context.Context, email string, ttl time.Duration) (string, error)
	Check(ctx context.Context, uuid, email, code string) error
	Consume(ctx context.Context, uuid, email string) error
}

type SessionRevoker interface {
	RevokeUser(ctx context.Context, userID int, reason string) error
}

type PasswordHasher interface {
	Hash(secret string) (string, error)
	Verify(hash, secret string) (bool, error)
}

type Images interface {
	StoreAvatar(ctx context.Context, userID int, upload *media.Upload) (string, error)
	StoreCover(ctx context.Context, userID int, upload *media.Upload) (string, error)
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
