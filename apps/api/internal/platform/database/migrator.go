package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/Ringyuki/shionlib/apps/api/migrations"
)

const (
	prismaFinalMigration = "20260925074133_user_only_games_with_resources"
	prismaBaseline       = 20260925074133
	migrationsTable      = "schema_migrations"
)

type Migrator struct {
	db     *sql.DB
	logger *slog.Logger
}

func NewMigrator(db *sql.DB, logger *slog.Logger) *Migrator {
	return &Migrator{db: db, logger: logger}
}

func (m *Migrator) Up(ctx context.Context) (err error) {
	runner, err := m.runner()
	if err != nil {
		return err
	}
	defer func() {
		err = errors.Join(err, closeRunner(runner))
	}()
	if err := m.adoptPrisma(ctx, runner); err != nil {
		return err
	}
	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	version, _, err := runner.Version()
	if err != nil {
		return fmt.Errorf("read migration version: %w", err)
	}
	m.logger.InfoContext(ctx, "database migrations applied", slog.Uint64("version", uint64(version)))
	return nil
}

func (m *Migrator) Status() (version uint, dirty bool, err error) {
	runner, err := m.runner()
	if err != nil {
		return 0, false, err
	}
	defer func() {
		err = errors.Join(err, closeRunner(runner))
	}()
	version, dirty, err = runner.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		return 0, false, nil
	}
	return version, dirty, err
}

func (m *Migrator) runner() (*migrate.Migrate, error) {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("open embedded migrations: %w", err)
	}
	driver, err := pgxmigrate.WithInstance(m.db, &pgxmigrate.Config{MigrationsTable: migrationsTable})
	if err != nil {
		return nil, fmt.Errorf("open migration driver: %w", err)
	}
	runner, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		return nil, fmt.Errorf("create migrator: %w", err)
	}
	return runner, nil
}

func (m *Migrator) adoptPrisma(ctx context.Context, runner *migrate.Migrate) error {
	_, dirty, err := runner.Version()
	switch {
	case err == nil && dirty:
		return errors.New("database migrations are dirty; resolve the failed migration manually before retrying")
	case err == nil:
		return nil
	case !errors.Is(err, migrate.ErrNilVersion):
		return fmt.Errorf("read migration version: %w", err)
	}
	var prismaTable sql.NullString
	if err := m.db.QueryRowContext(ctx, `SELECT to_regclass('public._prisma_migrations')::text`).Scan(&prismaTable); err != nil {
		return fmt.Errorf("detect prisma migrations: %w", err)
	}
	if !prismaTable.Valid {
		return nil
	}
	var pending int
	if err := m.db.QueryRowContext(ctx, `SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`).Scan(&pending); err != nil {
		return fmt.Errorf("inspect prisma migrations: %w", err)
	}
	if pending > 0 {
		return fmt.Errorf("prisma has %d unfinished migrations; finish or roll them back before adopting", pending)
	}
	var applied bool
	if err := m.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL)`, prismaFinalMigration).Scan(&applied); err != nil {
		return fmt.Errorf("inspect prisma migrations: %w", err)
	}
	if !applied {
		return fmt.Errorf("prisma migration %s is not applied; run the legacy migrations to completion first", prismaFinalMigration)
	}
	if err := runner.Force(prismaBaseline); err != nil {
		return fmt.Errorf("mark prisma baseline as applied: %w", err)
	}
	m.logger.InfoContext(ctx, "adopted prisma-managed database", slog.Int("baseline", prismaBaseline))
	return nil
}

func closeRunner(runner *migrate.Migrate) error {
	sourceErr, databaseErr := runner.Close()
	return errors.Join(sourceErr, databaseErr)
}
