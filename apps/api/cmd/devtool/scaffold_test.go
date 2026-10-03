package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

var notificationScaffold = scaffold{
	Name:   "notification",
	Title:  "Notification",
	Upper:  "NOTIFICATION",
	Table:  "notifications",
	Range:  630,
	Module: "github.com/Ringyuki/shionlib/apps/api",
}

func TestFeatureScaffoldFollowsThePackageLayout(t *testing.T) {
	root := t.TempDir()
	files, err := renderFeature(root, notificationScaffold)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	var got []string
	for path := range files {
		rel, err := filepath.Rel(root, path)
		if err != nil {
			t.Fatal(err)
		}
		got = append(got, filepath.ToSlash(rel))
	}
	slices.Sort(got)
	want := []string{
		"internal/adapter/postgres/ent/schema/notification.go",
		"internal/adapter/postgres/notificationpg/mapping.go",
		"internal/adapter/postgres/notificationpg/repository.go",
		"internal/adapter/postgres/notificationpg/repository_test.go",
		"internal/notification/errors.go",
		"internal/notification/notification.go",
		"internal/notification/notificationtest/contract.go",
		"internal/notification/notificationtest/memory.go",
		"internal/notification/notificationtest/memory_test.go",
		"internal/notification/ports.go",
		"internal/notification/service.go",
		"internal/notification/service_test.go",
		"internal/transport/http/notificationhttp/handler.go",
		"internal/transport/http/notificationhttp/request.go",
		"internal/transport/http/notificationhttp/response.go",
	}
	if !slices.Equal(got, want) {
		t.Fatalf("files:\n%s\nwant:\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
}

func TestFeatureScaffoldRefusesExistingPackages(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "internal", "notification"), 0o750); err != nil {
		t.Fatal(err)
	}
	if _, err := renderFeature(root, notificationScaffold); err == nil {
		t.Fatal("expected an error for an existing capability directory")
	}
}

func TestRegisterRangeAppendsOnce(t *testing.T) {
	root := t.TempDir()
	source, err := os.ReadFile(filepath.Join("..", "..", "internal", "apperror", "ranges.go"))
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(root, "internal", "apperror")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "ranges.go"), source, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := registerRange(root, notificationScaffold); err != nil {
		t.Fatalf("register: %v", err)
	}
	updated, err := os.ReadFile(filepath.Join(dir, "ranges.go"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(updated), `{Prefix: 630, Owner: "internal/notification", Domain: "notification"},`) {
		t.Fatalf("range not registered:\n%s", updated)
	}
	if err := registerRange(root, notificationScaffold); err == nil {
		t.Fatal("expected a duplicate range to be rejected")
	}
}
