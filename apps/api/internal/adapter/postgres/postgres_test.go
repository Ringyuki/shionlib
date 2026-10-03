package postgres_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
)

func TestTransactorCommitsRollsBackAndRunsAfterCommitHooks(t *testing.T) {
	db := pgtest.New(t)
	tx := postgres.NewTransactor(db.Ent)
	ctx := context.Background()
	user := db.User(t)

	var fired []string
	err := tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := postgres.Client(ctx, db.Ent).User.UpdateOneID(user).SetBio("committed").Exec(ctx); err != nil {
			return err
		}
		tx.AfterCommit(ctx, func(context.Context) { fired = append(fired, "commit") })
		return tx.WithinTransaction(ctx, func(ctx context.Context) error {
			tx.AfterCommit(ctx, func(context.Context) { fired = append(fired, "nested") })
			if len(fired) != 0 {
				t.Fatal("after-commit hooks must not run before the outer commit")
			}
			return nil
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(fired) != 2 {
		t.Fatalf("expected both hooks after commit, got %v", fired)
	}
	if got := db.Ent.User.GetX(ctx, user); got.Bio == nil || *got.Bio != "committed" {
		t.Fatalf("update was not committed: %+v", got.Bio)
	}

	fired = nil
	boom := errors.New("boom")
	err = tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if err := postgres.Client(ctx, db.Ent).User.UpdateOneID(user).SetBio("rolled back").Exec(ctx); err != nil {
			return err
		}
		tx.AfterCommit(ctx, func(context.Context) { fired = append(fired, "rollback") })
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("expected the callback error, got %v", err)
	}
	if len(fired) != 0 {
		t.Fatalf("after-commit hooks must not run on rollback: %v", fired)
	}
	if got := db.Ent.User.GetX(ctx, user); *got.Bio != "committed" {
		t.Fatalf("rollback did not restore the row: %s", *got.Bio)
	}

	ran := false
	tx.AfterCommit(ctx, func(context.Context) { ran = true })
	if !ran {
		t.Fatal("outside a transaction the hook runs immediately")
	}
}
