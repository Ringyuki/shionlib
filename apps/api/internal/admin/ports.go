package admin

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

type Accounts interface {
	Get(ctx context.Context, id int) (user.User, error)
	FindByEmail(ctx context.Context, email string) (user.User, bool, error)
	NameExists(ctx context.Context, name string) (bool, error)
	Update(ctx context.Context, id int, changes user.Changes) error
}

type UserStore interface {
	SearchUsers(ctx context.Context, filter UserFilter, page Page) ([]UserEntry, int, error)
	UserDetail(ctx context.Context, id int) (UserDetail, error)
	SetRole(ctx context.Context, id int, role actor.Role) error
	SetSponsorExpiry(ctx context.Context, id int, expiresAt *time.Time) error
	Sessions(ctx context.Context, filter SessionFilter, page Page) ([]Session, int, error)
}

type PermissionStore interface {
	RoleMask(ctx context.Context, role actor.Role, entity PermissionEntity) (int64, error)
	UserMask(ctx context.Context, userID int, entity PermissionEntity) (int64, error)
	PermissionMappings(ctx context.Context, entity PermissionEntity) ([]PermissionMapping, error)
	SetUserMask(ctx context.Context, userID int, entity PermissionEntity, mask int64) error
}

type Bans interface {
	Ban(ctx context.Context, id int, in user.BanInput) error
	Unban(ctx context.Context, id int) error
}

type SessionRevoker interface {
	RevokeUser(ctx context.Context, userID int, reason string) error
}

type PasswordHasher interface {
	Hash(secret string) (string, error)
}

type Quotas interface {
	AdminAdjustSize(ctx context.Context, userID int, action upload.QuotaAction, amount int64, reason string) error
	AdminAdjustUsed(ctx context.Context, userID int, action upload.QuotaAction, amount int64, reason string) error
	AdminResetUsed(ctx context.Context, userID int) error
}

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

type StatsStore interface {
	Overview(ctx context.Context, since time.Time) (Overview, error)
	DailyCreations(ctx context.Context, since time.Time, offset time.Duration) (DailyCounts, error)
}

type Cache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
}
