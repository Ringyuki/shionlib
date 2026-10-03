package admin

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	ReasonResetPassword = "admin_reset_password"
	ReasonForceLogout   = "admin_force_logout"
)

type Page = paging.Page

type UserSortField string

const (
	UserSortByID          UserSortField = "id"
	UserSortByName        UserSortField = "name"
	UserSortByEmail       UserSortField = "email"
	UserSortByRole        UserSortField = "role"
	UserSortByStatus      UserSortField = "status"
	UserSortByCreated     UserSortField = "created"
	UserSortByUpdated     UserSortField = "updated"
	UserSortByLastLoginAt UserSortField = "last_login_at"
)

type UserFilter struct {
	Search     string
	Role       *actor.Role
	Status     *user.Status
	SortBy     UserSortField
	Descending bool
}

type Counts struct {
	Comments  int
	Resources int
	Favorites int
	Edits     int
}

type UserEntry struct {
	ID               int
	Name             string
	Email            string
	Avatar           *string
	Role             actor.Role
	Status           user.Status
	Lang             user.Lang
	ContentLimit     actor.ContentLimit
	Created          time.Time
	Updated          time.Time
	LastLoginAt      *time.Time
	TwoFactorEnabled bool
	SponsorExpiresAt *time.Time
	Counts           Counts
}

type Quota struct {
	Size         int64
	Used         int64
	IsFirstGrant bool
}

type UserRef struct {
	ID   int
	Name string
}

type BanRecord struct {
	BannedAt     time.Time
	Reason       *string
	DurationDays *int
	Permanent    bool
	UnbannedAt   *time.Time
	BannedBy     *UserRef
}

type UserDetail struct {
	UserEntry
	Cover     *string
	Quota     *Quota
	LatestBan *BanRecord
}

type SessionFilter struct {
	UserID int
	Status *auth.SessionStatus
}

type Session struct {
	ID            int
	FamilyID      string
	Status        auth.SessionStatus
	IP            *string
	UserAgent     *string
	DeviceInfo    *string
	Created       time.Time
	Updated       time.Time
	LastUsedAt    *time.Time
	ExpiresAt     time.Time
	RotatedAt     *time.Time
	ReusedAt      *time.Time
	BlockedAt     *time.Time
	BlockedReason *string
}

type ProfileChanges struct {
	Name         *string
	Email        *string
	Lang         *user.Lang
	ContentLimit *actor.ContentLimit
}

type QuotaChange struct {
	Action upload.QuotaAction
	Amount int64
	Reason string
}

func CanManage(who actor.Actor, target user.User) bool {
	return who.UserID == target.ID || who.Role == actor.RoleSuperAdmin || who.Role > target.Role
}
