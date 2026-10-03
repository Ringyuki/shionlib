package admin

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

func bit(index int) int64 {
	return int64(1) << index
}

func (s *UserService) Permissions(ctx context.Context, who actor.Actor, id int, entity PermissionEntity) (Permissions, error) {
	target, err := s.manageable(ctx, who, id, true)
	if err != nil {
		return Permissions{}, err
	}
	roleMask, err := s.permissions.RoleMask(ctx, target.Role, entity)
	if err != nil {
		return Permissions{}, err
	}
	userMask, err := s.permissions.UserMask(ctx, id, entity)
	if err != nil {
		return Permissions{}, err
	}
	mappings, err := s.permissions.PermissionMappings(ctx, entity)
	if err != nil {
		return Permissions{}, err
	}
	view := Permissions{Entity: entity, RoleMask: roleMask, UserMask: userMask, AllowMask: roleMask | userMask, Groups: make([]PermissionGroup, len(mappings))}
	for i, mapping := range mappings {
		fromRole := roleMask&bit(mapping.BitIndex) != 0
		fromUser := userMask&bit(mapping.BitIndex) != 0
		source := SourceNone
		switch {
		case fromRole:
			source = SourceRole
		case fromUser:
			source = SourceUser
		}
		view.Groups[i] = PermissionGroup{
			PermissionMapping: mapping,
			Fields:            GroupFields(entity, mapping.Field),
			Enabled:           fromRole || fromUser,
			Source:            source,
			Mutable:           !fromRole,
		}
	}
	return view, nil
}

func (s *UserService) SetPermissions(ctx context.Context, who actor.Actor, id int, entity PermissionEntity, bits []int) (int64, error) {
	if _, err := s.manageable(ctx, who, id, true); err != nil {
		return 0, err
	}
	mappings, err := s.permissions.PermissionMappings(ctx, entity)
	if err != nil {
		return 0, err
	}
	valid := make(map[int]bool, len(mappings))
	for _, mapping := range mappings {
		valid[mapping.BitIndex] = true
	}
	invalid := []int{}
	var mask int64
	for _, index := range bits {
		if !valid[index] {
			invalid = append(invalid, index)
			continue
		}
		mask |= bit(index)
	}
	if len(invalid) > 0 {
		return 0, apperror.ErrValidationFailed.WithArgs(map[string]any{"invalidBits": invalid})
	}
	if err := s.permissions.SetUserMask(ctx, id, entity, mask); err != nil {
		return 0, err
	}
	return mask, nil
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
