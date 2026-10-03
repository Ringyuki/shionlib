package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
)

const (
	codeUniqueViolation     = "23505"
	codeForeignKeyViolation = "23503"
)

func NewClient(db *sql.DB) *ent.Client {
	return ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, db)))
}

type Transactor struct {
	client *ent.Client
}

func NewTransactor(client *ent.Client) *Transactor {
	return &Transactor{client: client}
}

func (t *Transactor) WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) (err error) {
	if ent.TxFromContext(ctx) != nil {
		return fn(ctx)
	}
	tx, err := t.client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			_ = tx.Rollback()
			panic(recovered)
		}
	}()
	if err := fn(ent.NewTxContext(ctx, tx)); err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return errors.Join(err, fmt.Errorf("rollback transaction: %w", rollbackErr))
		}
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

func (t *Transactor) AfterCommit(ctx context.Context, fn func(ctx context.Context)) {
	tx := ent.TxFromContext(ctx)
	if tx == nil {
		fn(ctx)
		return
	}
	tx.OnCommit(func(next ent.Committer) ent.Committer {
		return ent.CommitFunc(func(commitCtx context.Context, committed *ent.Tx) error {
			if err := next.Commit(commitCtx, committed); err != nil {
				return err
			}
			fn(context.WithoutCancel(ctx))
			return nil
		})
	})
}

func Client(ctx context.Context, base *ent.Client) *ent.Client {
	if tx := ent.TxFromContext(ctx); tx != nil {
		return tx.Client()
	}
	return base
}

func IsNotFound(err error) bool {
	return ent.IsNotFound(err)
}

func IsUniqueViolation(err error, constraint string) bool {
	return hasCode(err, codeUniqueViolation, constraint)
}

func IsForeignKeyViolation(err error, constraint string) bool {
	return hasCode(err, codeForeignKeyViolation, constraint)
}

func hasCode(err error, code, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != code {
		return false
	}
	return constraint == "" || pgErr.ConstraintName == constraint
}
