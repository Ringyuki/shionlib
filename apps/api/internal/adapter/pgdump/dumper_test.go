package pgdump_test

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/pgdump"
)

func script(t *testing.T, body string) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("shell scripts are not available")
	}
	path := filepath.Join(t.TempDir(), "pg_dump")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body+"\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestConnectionMovesThePasswordOutOfTheArguments(t *testing.T) {
	conninfo, password, err := pgdump.Connection("postgres://app:s3cret@db.internal:5432/shionlib?sslmode=require&search_path=public&pool_max_conns=10")
	if err != nil {
		t.Fatal(err)
	}
	if password != "s3cret" || conninfo != "postgres://app@db.internal:5432/shionlib?sslmode=require" {
		t.Fatalf("unexpected connection %q %q", conninfo, password)
	}
	conninfo, password, _ = pgdump.Connection("postgresql://db/shionlib?user=app&password=pw")
	if password != "pw" || strings.Contains(conninfo, "pw") {
		t.Fatalf("query passwords are moved too: %q %q", conninfo, password)
	}
	if _, _, err := pgdump.Connection("mysql://x"); err == nil {
		t.Fatal("non-postgres URLs are rejected")
	}
}

func TestDumpStreamsStdout(t *testing.T) {
	argsFile := filepath.Join(t.TempDir(), "args")
	binary := script(t, `echo "$@" > `+argsFile+`; printf '%s' "$PGPASSWORD" > `+argsFile+`.pw; printf 'PGDMP-binary'`)
	dump, err := pgdump.New(binary, "postgres://app:s3cret@localhost:5432/shionlib").Dump(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(dump)
	if err != nil {
		t.Fatal(err)
	}
	if err := dump.Close(); err != nil {
		t.Fatal(err)
	}
	if string(data) != "PGDMP-binary" {
		t.Fatalf("unexpected dump %q", data)
	}
	args, _ := os.ReadFile(argsFile)
	if strings.TrimSpace(string(args)) != "--format=custom --encoding=UTF8 --no-owner --no-privileges --dbname=postgres://app@localhost:5432/shionlib" {
		t.Fatalf("unexpected arguments %q", args)
	}
	if pw, _ := os.ReadFile(argsFile + ".pw"); string(pw) != "s3cret" {
		t.Fatalf("password is passed through the environment, got %q", pw)
	}
}

func TestDumpFailuresSurfaceAtTheEndOfTheStream(t *testing.T) {
	for name, body := range map[string]string{
		"non-zero exit": `printf 'partial'; echo 'connection refused' >&2; exit 1`,
		"empty dump":    `exit 0`,
	} {
		t.Run(name, func(t *testing.T) {
			dump, err := pgdump.New(script(t, body), "postgres://localhost/db").Dump(context.Background())
			if err != nil {
				t.Fatal(err)
			}
			_, err = io.ReadAll(dump)
			if err == nil {
				t.Fatal("a failed dump must not look like a complete stream")
			}
			if name == "non-zero exit" && !strings.Contains(err.Error(), "connection refused") {
				t.Fatalf("stderr is reported: %v", err)
			}
			_ = dump.Close()
		})
	}
}

func TestCloseStopsAnUnfinishedDump(t *testing.T) {
	dump, err := pgdump.New(script(t, `printf 'x'; exec sleep 30`), "postgres://localhost/db").Dump(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, 1)
	if _, err := dump.Read(buf); err != nil {
		t.Fatal(err)
	}
	if err := dump.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := dump.Read(buf); err == nil {
		t.Fatal("reads after close must fail")
	}
}

func TestMissingBinary(t *testing.T) {
	if _, err := pgdump.New(filepath.Join(t.TempDir(), "missing"), "postgres://localhost/db").Dump(context.Background()); err == nil {
		t.Fatal("a missing binary must fail to start")
	}
}
