package banpg_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/banpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userbannedrecord"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/userloginsession"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var (
	_ report.Banner = (*banpg.Banner)(nil)
	_ scan.Banner   = (*banpg.Banner)(nil)
)

type recorder struct {
	mu     sync.Mutex
	blocks map[string]time.Duration
}

func (r *recorder) Block(_ context.Context, familyID string, ttl time.Duration) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.blocks == nil {
		r.blocks = map[string]time.Duration{}
	}
	r.blocks[familyID] = ttl
	return nil
}

func (r *recorder) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.blocks)
}

var sequence atomic.Int64

var now = time.Date(2026, 8, 1, 10, 0, 0, 0, time.UTC)

func setup(t *testing.T) (*pgtest.DB, *banpg.Banner, *postgres.Transactor, *recorder) {
	t.Helper()
	db := pgtest.New(t)
	tx := postgres.NewTransactor(db.Ent)
	families := &recorder{}
	return db, banpg.NewBanner(db.Ent, families, tx, func() time.Time { return now }), tx, families
}

func session(t *testing.T, db *pgtest.DB, userID int) string {
	t.Helper()
	row, err := db.Ent.UserLoginSession.Create().
		SetUserID(userID).
		SetRefreshTokenHash(fmt.Sprintf("hash-%d", sequence.Add(1))).
		SetRefreshTokenPrefix(fmt.Sprintf("prefix-%d", sequence.Add(1))).
		SetExpiresAt(now.Add(time.Hour)).
		Save(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return row.FamilyID
}

func TestBanBlocksAccountAndFamiliesAfterCommit(t *testing.T) {
	ctx := context.Background()
	db, banner, tx, families := setup(t)
	target, reviewer := db.User(t), db.User(t)
	first, second := session(t, db, target), session(t, db, target)
	other := session(t, db, reviewer)

	err := tx.WithinTransaction(ctx, func(ctx context.Context) error {
		applied, err := banner.Ban(ctx, target, &reviewer, "Resource report: MALWARE", 7)
		if err != nil {
			return err
		}
		if !applied {
			return errors.New("ban was not applied")
		}
		if families.count() != 0 {
			return errors.New("families were blocked before commit")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if families.count() != 2 || families.blocks[first] != 7*24*time.Hour || families.blocks[second] != 7*24*time.Hour {
		t.Fatalf("families of the banned user are blocked for the ban duration: %v", families.blocks)
	}
	if _, blocked := families.blocks[other]; blocked {
		t.Fatal("other users' families must stay active")
	}

	user, err := db.Ent.User.Get(ctx, target)
	if err != nil || user.Status != 2 {
		t.Fatalf("user status: %+v %v", user, err)
	}
	record, err := db.Ent.UserBannedRecord.Query().Where(userbannedrecord.UserID(target)).Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if record.BannedBy == nil || *record.BannedBy != reviewer || record.BannedReason == nil || *record.BannedReason != "Resource report: MALWARE" || record.BannedDurationDays == nil || *record.BannedDurationDays != 7 || record.IsPermanent || !record.BannedAt.Equal(now) {
		t.Fatalf("ban record: %+v", record)
	}
	sessions, err := db.Ent.UserLoginSession.Query().Where(userloginsession.UserID(target)).All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range sessions {
		if row.Status != 4 || row.BlockedReason == nil || *row.BlockedReason != "user_banned" || row.BlockedAt == nil {
			t.Fatalf("session not blocked: %+v", row)
		}
	}

	applied, err := banner.Ban(ctx, target, nil, "again", 3)
	if err != nil || applied {
		t.Fatalf("already banned users are skipped: %v %v", applied, err)
	}
	if count, _ := db.Ent.UserBannedRecord.Query().Where(userbannedrecord.UserID(target)).Count(ctx); count != 1 {
		t.Fatalf("no second ban record: %d", count)
	}
}

func TestBanSkipsAndRejects(t *testing.T) {
	ctx := context.Background()
	db, banner, tx, families := setup(t)
	superAdmin, user := db.User(t), db.User(t)
	if err := db.Ent.User.UpdateOneID(superAdmin).SetRole(3).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	session(t, db, superAdmin)
	userFamily := session(t, db, user)

	if applied, err := banner.Ban(ctx, superAdmin, nil, "Uploaded harmful file (3 times)", 30); err != nil || applied {
		t.Fatalf("super admins are never banned: %v %v", applied, err)
	}
	if applied, err := banner.Ban(ctx, 987654, nil, "missing", 30); err != nil || applied {
		t.Fatalf("missing users are skipped: %v %v", applied, err)
	}
	if _, err := banner.Ban(ctx, user, nil, "zero", 0); err == nil {
		t.Fatal("a non-positive duration must be rejected")
	}

	rollback := errors.New("rollback")
	err := tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if applied, err := banner.Ban(ctx, user, nil, "reason", 3); err != nil || !applied {
			t.Fatalf("ban inside transaction: %v %v", applied, err)
		}
		return rollback
	})
	if !errors.Is(err, rollback) {
		t.Fatal(err)
	}
	if families.count() != 0 {
		t.Fatalf("rolled back bans must not block families: %v", families.blocks)
	}
	got, _ := db.Ent.User.Get(ctx, user)
	if got.Status != 1 {
		t.Fatalf("rolled back ban changed the user: %+v", got)
	}

	applied, err := banner.Ban(ctx, user, nil, "outside transaction", 2)
	if err != nil || !applied {
		t.Fatalf("ban without transaction: %v %v", applied, err)
	}
	if families.count() != 1 || families.blocks[userFamily] != 48*time.Hour {
		t.Fatalf("families blocked immediately without a transaction: %v", families.blocks)
	}
}
