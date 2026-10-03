package banpg

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entuser "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/user"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
)

const (
	roleSuperAdmin      = 3
	userBanned          = 2
	sessionBlocked      = 4
	blockedReasonBanned = "user_banned"
)

var errInvalidDuration = errors.New("ban duration must be positive")

type FamilyBlocker interface {
	Block(ctx context.Context, familyID string, ttl time.Duration) error
}

type AfterCommitter interface {
	AfterCommit(ctx context.Context, fn func(ctx context.Context))
}

type Banner struct {
	client   *ent.Client
	families FamilyBlocker
	tx       AfterCommitter
	now      func() time.Time
}

func NewBanner(client *ent.Client, families FamilyBlocker, tx AfterCommitter, now func() time.Time) *Banner {
	return &Banner{client: client, families: families, tx: tx, now: now}
}

func (b *Banner) Ban(ctx context.Context, userID int, bannedBy *int, reason string, days int) (bool, error) {
	db := postgres.Client(ctx, b.client)
	target, err := db.User.Query().
		Where(entuser.ID(userID), entuser.RoleNEQ(roleSuperAdmin)).
		Select(entuser.FieldID, entuser.FieldStatus).
		ForUpdate().
		Only(ctx)
	if postgres.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("load user %d to ban: %w", userID, err)
	}
	if target.Status == userBanned {
		return false, nil
	}
	if days <= 0 {
		return false, errInvalidDuration
	}
	now := b.now().UTC()
	err = db.UserBannedRecord.Create().
		SetUserID(userID).
		SetBannedAt(now).
		SetBannedReason(reason).
		SetNillableBannedBy(bannedBy).
		SetBannedDurationDays(days).
		SetIsPermanent(false).
		Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("record ban of user %d: %w", userID, err)
	}
	if err := db.User.UpdateOneID(userID).SetStatus(userBanned).Exec(ctx); err != nil {
		return false, fmt.Errorf("mark user %d banned: %w", userID, err)
	}
	err = db.UserLoginSession.Update().
		Where(userloginsession.UserID(userID)).
		SetStatus(sessionBlocked).
		SetBlockedAt(now).
		SetBlockedReason(blockedReasonBanned).
		Exec(ctx)
	if err != nil {
		return false, fmt.Errorf("block sessions of user %d: %w", userID, err)
	}
	families, err := db.UserLoginSession.Query().
		Where(userloginsession.UserID(userID)).
		Unique(true).
		Select(userloginsession.FieldFamilyID).
		Strings(ctx)
	if err != nil {
		return false, fmt.Errorf("list session families of user %d: %w", userID, err)
	}
	ttl := time.Duration(days) * 24 * time.Hour
	b.tx.AfterCommit(ctx, func(ctx context.Context) {
		for _, family := range families {
			_ = b.families.Block(ctx, family, ttl)
		}
	})
	return true, nil
}
