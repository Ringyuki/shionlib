package admin

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	ReasonResetPassword = "admin_reset_password"
	ReasonForceLogout   = "admin_force_logout"
)

type Page struct {
	Number int
	Size   int
}

func (p Page) Offset() int {
	return (p.Number - 1) * p.Size
}

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

type UserDeps struct {
	Accounts    Accounts
	Store       UserStore
	Permissions PermissionStore
	Bans        Bans
	Sessions    SessionRevoker
	Passwords   PasswordHasher
	Quotas      Quotas
	Tx          Transactor
}

type UserService struct {
	accounts    Accounts
	store       UserStore
	permissions PermissionStore
	bans        Bans
	sessions    SessionRevoker
	passwords   PasswordHasher
	quotas      Quotas
	tx          Transactor
}

func NewUserService(deps UserDeps) *UserService {
	return &UserService{
		accounts:    deps.Accounts,
		store:       deps.Store,
		permissions: deps.Permissions,
		bans:        deps.Bans,
		sessions:    deps.Sessions,
		passwords:   deps.Passwords,
		quotas:      deps.Quotas,
		tx:          deps.Tx,
	}
}

func (s *UserService) Search(ctx context.Context, filter UserFilter, page Page) ([]UserEntry, int, error) {
	filter.Search = strings.TrimSpace(filter.Search)
	return s.store.SearchUsers(ctx, filter, page)
}

func (s *UserService) Detail(ctx context.Context, id int) (UserDetail, error) {
	return s.store.UserDetail(ctx, id)
}

func (s *UserService) UpdateProfile(ctx context.Context, who actor.Actor, id int, in ProfileChanges) (user.User, bool, error) {
	var (
		updated user.User
		changed bool
	)
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		target, err := s.manageable(ctx, who, id, true)
		if err != nil {
			return err
		}
		changes, err := s.profileChanges(ctx, target, in)
		if err != nil {
			return err
		}
		if changes == (user.Changes{}) {
			updated = target
			return nil
		}
		if err := s.accounts.Update(ctx, id, changes); err != nil {
			return err
		}
		changed = true
		updated, err = s.accounts.Get(ctx, id)
		return err
	})
	return updated, changed, err
}

func (s *UserService) profileChanges(ctx context.Context, target user.User, in ProfileChanges) (user.Changes, error) {
	var changes user.Changes
	if in.Name != nil && *in.Name != "" && *in.Name != target.Name {
		taken, err := s.accounts.NameExists(ctx, *in.Name)
		if err != nil {
			return user.Changes{}, err
		}
		if taken {
			return user.Changes{}, user.ErrNameAlreadyExists
		}
		changes.Name = in.Name
	}
	if in.Email != nil && *in.Email != "" && *in.Email != target.Email {
		if _, taken, err := s.accounts.FindByEmail(ctx, *in.Email); err != nil {
			return user.Changes{}, err
		} else if taken {
			return user.Changes{}, user.ErrEmailAlreadyExists
		}
		changes.Email = in.Email
	}
	if in.Lang != nil && *in.Lang != "" {
		changes.Lang = in.Lang
	}
	changes.ContentLimit = in.ContentLimit
	return changes, nil
}

func (s *UserService) SetRole(ctx context.Context, who actor.Actor, id int, role actor.Role) error {
	if _, err := s.accounts.Get(ctx, id); err != nil {
		return err
	}
	if who.UserID == id || who.Role != actor.RoleSuperAdmin {
		return auth.ErrUnauthorized
	}
	return s.store.SetRole(ctx, id, role)
}

func (s *UserService) Ban(ctx context.Context, who actor.Actor, id int, in user.BanInput) error {
	if _, err := s.manageable(ctx, who, id, false); err != nil {
		return err
	}
	admin := who.UserID
	in.BannedBy = &admin
	return s.bans.Ban(ctx, id, in)
}

func (s *UserService) Unban(ctx context.Context, who actor.Actor, id int) error {
	if _, err := s.manageable(ctx, who, id, false); err != nil {
		return err
	}
	return s.bans.Unban(ctx, id)
}

func (s *UserService) ResetPassword(ctx context.Context, who actor.Actor, id int, password string) error {
	if _, err := s.manageable(ctx, who, id, false); err != nil {
		return err
	}
	hash, err := s.passwords.Hash(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := s.accounts.Update(ctx, id, user.Changes{PasswordHash: &hash}); err != nil {
			return err
		}
		return s.sessions.RevokeUser(ctx, id, ReasonResetPassword)
	})
}

func (s *UserService) ForceLogout(ctx context.Context, who actor.Actor, id int) error {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return err
	}
	return s.sessions.RevokeUser(ctx, id, ReasonForceLogout)
}

func (s *UserService) Sessions(ctx context.Context, filter SessionFilter, page Page) ([]Session, int, error) {
	return s.store.Sessions(ctx, filter, page)
}

func (s *UserService) AdjustQuotaSize(ctx context.Context, who actor.Actor, id int, change QuotaChange) error {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return err
	}
	return s.quotas.AdminAdjustSize(ctx, id, change.Action, change.Amount, change.Reason)
}

func (s *UserService) AdjustQuotaUsed(ctx context.Context, who actor.Actor, id int, change QuotaChange) error {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return err
	}
	return s.quotas.AdminAdjustUsed(ctx, id, change.Action, change.Amount, change.Reason)
}

func (s *UserService) ResetQuotaUsed(ctx context.Context, who actor.Actor, id int) error {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return err
	}
	return s.quotas.AdminResetUsed(ctx, id)
}

func (s *UserService) SetSponsorExpiry(ctx context.Context, id int, expiresAt *time.Time) error {
	if _, err := s.accounts.Get(ctx, id); err != nil {
		return err
	}
	return s.store.SetSponsorExpiry(ctx, id, expiresAt)
}

func (s *UserService) manageable(ctx context.Context, who actor.Actor, id int, allowSelf bool) (user.User, error) {
	target, err := s.accounts.Get(ctx, id)
	if err != nil {
		return user.User{}, err
	}
	if who.UserID == id && !allowSelf {
		return user.User{}, auth.ErrUnauthorized
	}
	if !CanManage(who, target) {
		return user.User{}, auth.ErrUnauthorized
	}
	return target, nil
}

func CanManage(who actor.Actor, target user.User) bool {
	return who.UserID == target.ID || who.Role == actor.RoleSuperAdmin || who.Role > target.Role
}
