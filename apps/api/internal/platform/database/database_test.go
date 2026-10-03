package database_test

import (
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/database/databasetest"
)

func TestOpenRejectsMalformedURLs(t *testing.T) {
	if _, err := database.Open(t.Context(), database.Options{URL: "::not a url"}); err == nil {
		t.Fatal("expected a parse error")
	}
}

func TestSessionsUseUTCAndTheConfiguredLimits(t *testing.T) {
	db, err := database.Open(t.Context(), database.Options{URL: databasetest.AdminURL(t), MaxConns: 2, StatementTimeout: 1500 * time.Millisecond, ApplicationName: "shionlib-test"})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close(t.Context()) }()
	if err := db.Ping(t.Context()); err != nil {
		t.Fatal(err)
	}
	var timezone, application, timeout string
	if err := db.SQL.QueryRowContext(t.Context(), `SELECT current_setting('TimeZone'), current_setting('application_name'), current_setting('statement_timeout')`).Scan(&timezone, &application, &timeout); err != nil {
		t.Fatal(err)
	}
	if timezone != "UTC" || application != "shionlib-test" || timeout != "1500ms" {
		t.Fatalf("session settings %q %q %q", timezone, application, timeout)
	}
	if db.Pool.Config().MaxConns != 2 {
		t.Fatalf("pool size %d", db.Pool.Config().MaxConns)
	}
}
