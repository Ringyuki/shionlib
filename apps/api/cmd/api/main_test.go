package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUnknownCommandsFail(t *testing.T) {
	err := run(t.Context(), []string{"launch"})
	if err == nil || !strings.Contains(err.Error(), `unknown command "launch"`) {
		t.Fatalf("unexpected result %v", err)
	}
	if err := run(t.Context(), []string{"search", "drop"}); err == nil {
		t.Fatal("search needs the reindex subcommand")
	}
	for _, id := range []string{"all", "0", "-3"} {
		if err := run(t.Context(), []string{"recheck", "12", id}); err == nil || !strings.Contains(err.Error(), "ids of files") {
			t.Fatalf("recheck %s: %v", id, err)
		}
	}
	if err := run(t.Context(), []string{"describe", "everything"}); err == nil || !strings.Contains(err.Error(), "apply to write it") {
		t.Fatalf("describe everything: %v", err)
	}
	for _, limit := range []string{"all", "0", "-3"} {
		if err := run(t.Context(), []string{"inspect", limit}); err == nil || !strings.Contains(err.Error(), "number of resources") {
			t.Fatalf("inspect %s: %v", limit, err)
		}
	}
	if err := run(t.Context(), []string{"inspect", "-workers", "0", "10"}); err == nil || !strings.Contains(err.Error(), "at least one worker") {
		t.Fatalf("inspect without workers: %v", err)
	}
}

func TestOpenAPIIsWrittenOfflineAndMarkedGenerated(t *testing.T) {
	path := filepath.Join(t.TempDir(), "openapi.json")
	if err := run(t.Context(), []string{"openapi", path}); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		OpenAPI string `json:"openapi"`
		Info    struct {
			Title       string `json:"title"`
			GeneratedBy string `json:"x-generated-by"`
		} `json:"info"`
		Paths map[string]any `json:"paths"`
	}
	if err := json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(document.OpenAPI, "3.") || document.Info.Title != "Shionlib API" || !strings.Contains(document.Info.GeneratedBy, "do not edit") || len(document.Paths) == 0 {
		t.Fatalf("document %+v", document.Info)
	}
	if err := run(t.Context(), []string{"openapi", ""}); err == nil {
		t.Fatal("an empty output path is rejected")
	}
}
