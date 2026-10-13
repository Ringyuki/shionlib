package databasetest

import (
	"os"
	"testing"
)

func AdminURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("REQUIRE_INTEGRATION") != "" {
			t.Fatal("TEST_DATABASE_URL is required when REQUIRE_INTEGRATION is set")
		}
		t.Skip("TEST_DATABASE_URL is not set; skipping database integration test")
	}
	return url
}
