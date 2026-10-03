package pgtest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"slices"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database"
	"github.com/Ringyuki/shionlib/apps/api/migrations"
)

const templateLockKey = 7351002

type DB struct {
	SQL *sql.DB
	Ent *ent.Client
	URL string
}

var (
	templateOnce sync.Once
	templateName string
	templateErr  error
)

func New(t *testing.T) *DB {
	t.Helper()
	adminURL := os.Getenv("TEST_DATABASE_URL")
	if adminURL == "" {
		if os.Getenv("REQUIRE_INTEGRATION") != "" {
			t.Fatal("TEST_DATABASE_URL is required when REQUIRE_INTEGRATION is set")
		}
		t.Skip("TEST_DATABASE_URL is not set; skipping database integration test")
	}
	ctx := context.Background()
	templateOnce.Do(func() {
		templateName, templateErr = ensureTemplate(ctx, adminURL)
	})
	if templateErr != nil {
		t.Fatalf("prepare template database: %v", templateErr)
	}
	name := "shionlib_test_" + randomSuffix(t)
	if err := adminExec(ctx, adminURL, fmt.Sprintf(`CREATE DATABASE %s TEMPLATE %s`, pgx.Identifier{name}.Sanitize(), pgx.Identifier{templateName}.Sanitize())); err != nil {
		t.Fatalf("create test database: %v", err)
	}
	testURL := withDatabase(t, adminURL, name)
	sqlDB, err := sql.Open("pgx", testURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
		_ = adminExec(context.Background(), adminURL, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, pgx.Identifier{name}.Sanitize()))
	})
	return &DB{SQL: sqlDB, Ent: postgres.NewClient(sqlDB), URL: testURL}
}

func ensureTemplate(ctx context.Context, adminURL string) (string, error) {
	digest, err := migrationsDigest()
	if err != nil {
		return "", err
	}
	name := "shionlib_template_" + digest[:16]
	conn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		return "", err
	}
	defer func() {
		_ = conn.Close(ctx)
	}()
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, templateLockKey); err != nil {
		return "", err
	}
	defer func() {
		_, _ = conn.Exec(ctx, `SELECT pg_advisory_unlock($1)`, templateLockKey)
	}()
	var exists bool
	if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, name).Scan(&exists); err != nil {
		return "", err
	}
	if exists {
		return name, nil
	}
	building := name + "_building"
	if _, err := conn.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, pgx.Identifier{building}.Sanitize())); err != nil {
		return "", err
	}
	if _, err := conn.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s`, pgx.Identifier{building}.Sanitize())); err != nil {
		return "", err
	}
	buildURL, err := replaceDatabase(adminURL, building)
	if err != nil {
		return "", err
	}
	migrationDB, err := sql.Open("pgx", buildURL)
	if err != nil {
		return "", err
	}
	migrateErr := database.NewMigrator(migrationDB, slog.New(slog.NewTextHandler(io.Discard, nil))).Up(ctx)
	_ = migrationDB.Close()
	if migrateErr != nil {
		return "", migrateErr
	}
	if _, err := conn.Exec(ctx, fmt.Sprintf(`ALTER DATABASE %s RENAME TO %s`, pgx.Identifier{building}.Sanitize(), pgx.Identifier{name}.Sanitize())); err != nil {
		return "", err
	}
	return name, nil
}

func migrationsDigest() (string, error) {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return "", err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	slices.Sort(names)
	hash := sha256.New()
	for _, name := range names {
		raw, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return "", err
		}
		hash.Write([]byte(name))
		hash.Write(raw)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func adminExec(ctx context.Context, adminURL, statement string) error {
	conn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		return err
	}
	defer func() {
		_ = conn.Close(ctx)
	}()
	_, err = conn.Exec(ctx, statement)
	return err
}

func withDatabase(t *testing.T, raw, name string) string {
	t.Helper()
	replaced, err := replaceDatabase(raw, name)
	if err != nil {
		t.Fatal(err)
	}
	return replaced
}

func replaceDatabase(raw, name string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	parsed.Path = "/" + name
	return parsed.String(), nil
}

func randomSuffix(t *testing.T) string {
	t.Helper()
	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatal(err)
	}
	return hex.EncodeToString(b[:])
}
