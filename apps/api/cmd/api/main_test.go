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
