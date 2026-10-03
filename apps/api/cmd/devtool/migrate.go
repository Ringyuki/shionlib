package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	atlasmigrate "ariga.io/atlas/sql/migrate"
	"ariga.io/atlas/sql/sqltool"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql/schema"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/migrate"
)

const migrationsDir = "migrations"

func registerPostgresDriver() {
	if !slicesContains(sql.Drivers(), "postgres") {
		sql.Register("postgres", stdlib.GetDefaultDriver())
	}
}

func slicesContains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func migrationDir(root string) (*sqltool.GolangMigrateDir, error) {
	path := filepath.Join(root, migrationsDir)
	if override := os.Getenv("MIGRATIONS_DIR"); override != "" {
		path = override
	}
	return sqltool.NewGolangMigrateDir(path)
}

func devDatabaseURL() (string, error) {
	url := os.Getenv("DEV_DATABASE_URL")
	if url == "" {
		return "", errors.New("DEV_DATABASE_URL must point to a scratch database; its public schema is dropped on every run")
	}
	return url, nil
}

func diffMigration(ctx context.Context, root, name string) error {
	dir, err := migrationDir(root)
	if err != nil {
		return err
	}
	url, err := devDatabaseURL()
	if err != nil {
		return err
	}
	if err := refreshSum(dir); err != nil {
		return err
	}
	registerPostgresDriver()
	if err := resetScratchDatabase(ctx, url); err != nil {
		return err
	}
	options := []schema.MigrateOption{
		schema.WithDir(dir),
		schema.WithMigrationMode(schema.ModeReplay),
		schema.WithDialect(dialect.Postgres),
		schema.WithFormatter(sqltool.GolangMigrateFormatter),
		schema.WithDropColumn(true),
		schema.WithDropIndex(true),
		schema.WithDiffOptions(schemaDiffOptions()...),
		schema.WithDiffHook(conventionHook),
	}
	if err := migrate.NamedDiff(ctx, url, name, options...); err != nil {
		return fmt.Errorf("diff migration: %w", err)
	}
	return nil
}

func refreshSum(dir atlasmigrate.Dir) error {
	sum, err := dir.Checksum()
	if err != nil {
		return fmt.Errorf("checksum migrations: %w", err)
	}
	return atlasmigrate.WriteSumFile(dir, sum)
}

func checkMigrationDrift(ctx context.Context, root string) error {
	source := filepath.Join(root, migrationsDir)
	scratch, err := os.MkdirTemp("", "shionlib-migrations-")
	if err != nil {
		return err
	}
	defer func() {
		_ = os.RemoveAll(scratch)
	}()
	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(source, filepath.Base(entry.Name())))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(scratch, filepath.Base(entry.Name())), raw, 0o600); err != nil {
			return err
		}
	}
	if err := os.Setenv("MIGRATIONS_DIR", scratch); err != nil {
		return err
	}
	if err := diffMigration(ctx, root, "drift"); err != nil {
		return err
	}
	generated, err := filepath.Glob(filepath.Join(scratch, "*_drift.up.sql"))
	if err != nil {
		return err
	}
	if len(generated) == 0 {
		return nil
	}
	drift, err := os.ReadFile(generated[0])
	if err != nil {
		return err
	}
	return fmt.Errorf("ent schema and migrations have drifted; run `devtool migrate diff <name>`:\n%s", drift)
}

func resetScratchDatabase(ctx context.Context, url string) error {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return err
	}
	defer func() {
		_ = db.Close()
	}()
	if _, err := db.ExecContext(ctx, `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`); err != nil {
		return fmt.Errorf("reset scratch database: %w", err)
	}
	return nil
}
