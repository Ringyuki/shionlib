package clamd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExcerptRules(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "clamav-scan.log")
	var lines []string
	for i := range 40 {
		lines = append(lines, fmt.Sprintf("  line %02d other.sltf: stream: OK  ", i))
	}
	if err := os.WriteFile(logPath, []byte(strings.Join(lines, "\n")+"\n\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	fallback := excerpt(logPath, "/upload/target.sltf")
	if fallback == nil {
		t.Fatal("expected a fallback excerpt")
	}
	got := strings.Split(*fallback, "\n")
	if len(got) != 20 || got[0] != "line 20 other.sltf: stream: OK" || got[19] != "line 39 other.sltf: stream: OK" {
		t.Fatalf("fallback keeps the last 20 trimmed lines: %q", got)
	}
	var matching []string
	for i := range 35 {
		matching = append(matching, fmt.Sprintf("m%02d /upload/target.sltf: stream: OK", i))
	}
	matching = append(matching, "x virus Found elsewhere")
	if err := os.WriteFile(logPath, []byte(strings.Join(append(lines, matching...), "\r\n")), 0o600); err != nil {
		t.Fatal(err)
	}
	matched := strings.Split(*excerpt(logPath, "/upload/target.sltf"), "\n")
	if len(matched) != 30 || matched[0] != "m06 /upload/target.sltf: stream: OK" || matched[29] != "x virus Found elsewhere" {
		t.Fatalf("matched lines are capped at the last 30: %q", matched)
	}
	if err := os.WriteFile(logPath, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if excerpt(logPath, "x") != nil {
		t.Fatal("empty logs have no excerpt")
	}
	if excerpt(filepath.Join(dir, "missing.log"), "x") != nil {
		t.Fatal("unreadable logs have no excerpt")
	}
	big := strings.Repeat("filler line without match\n", 20000) + "tail FOUND\n"
	if err := os.WriteFile(logPath, []byte(big), 0o600); err != nil {
		t.Fatal(err)
	}
	if tail := excerpt(logPath, "nothing"); tail == nil || *tail != "tail FOUND" {
		t.Fatalf("only the last 256 KiB is read: %v", tail)
	}
}
