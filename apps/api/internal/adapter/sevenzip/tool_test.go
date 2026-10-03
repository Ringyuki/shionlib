package sevenzip_test

import (
	"crypto/rand"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.ArchiveTool = (*sevenzip.Tool)(nil)

func installedBinary(t *testing.T) string {
	t.Helper()
	for _, name := range []string{"7zz", "7z"} {
		if _, err := exec.LookPath(name); err == nil {
			return name
		}
	}
	t.Skip("7-Zip is not installed")
	return ""
}

func archive(t *testing.T, binary, dir, name string, extra []string, files ...string) string {
	t.Helper()
	target := filepath.Join(dir, name)
	args := append([]string{"a", target}, extra...)
	args = append(args, files...)
	cmd := exec.CommandContext(t.Context(), binary, args...)
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("create %s: %v\n%s", name, err, out)
	}
	return target
}

func TestInspectArchiveClassifiesRealArchives(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	payload := make([]byte, 64<<10)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "data.bin"), payload, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "readme.txt"), []byte("hello\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	valid := archive(t, binary, dir, "valid.7z", nil, "readme.txt", "data.bin")
	encryptedHeaders := archive(t, binary, dir, "headers.7z", []string{"-pSECRET", "-mhe=on"}, "readme.txt")
	encryptedData := archive(t, binary, dir, "data.7z", []string{"-pSECRET"}, "readme.txt")
	raw, err := os.ReadFile(valid)
	if err != nil {
		t.Fatal(err)
	}
	truncated := filepath.Join(dir, "truncated.7z")
	if err := os.WriteFile(truncated, raw[:len(raw)/2], 0o600); err != nil {
		t.Fatal(err)
	}
	corrupted := filepath.Join(dir, "corrupted.7z")
	damaged := append([]byte(nil), raw...)
	for i := 1000; i < 1100; i++ {
		damaged[i] ^= 0xff
	}
	if err := os.WriteFile(corrupted, damaged, 0o600); err != nil {
		t.Fatal(err)
	}
	tool := sevenzip.New(binary)
	cases := map[string]download.CheckStatus{
		valid:                            download.CheckOK,
		encryptedHeaders:                 download.CheckEncrypted,
		encryptedData:                    download.CheckEncrypted,
		corrupted:                        download.CheckBrokenOrTruncated,
		truncated:                        download.CheckBrokenOrUnsupported,
		filepath.Join(dir, "readme.txt"): download.CheckBrokenOrUnsupported,
		filepath.Join(dir, "missing.7z"): download.CheckBrokenOrUnsupported,
	}
	for path, want := range cases {
		got, err := scan.InspectArchive(t.Context(), tool, path)
		if err != nil {
			t.Fatalf("%s: %v", filepath.Base(path), err)
		}
		if got != want {
			t.Errorf("%s classified %d, want %d", filepath.Base(path), got, want)
		}
	}
}

func TestListReportsFailuresWithoutGoErrors(t *testing.T) {
	binary := installedBinary(t)
	run, err := sevenzip.New(binary).List(t.Context(), filepath.Join(t.TempDir(), "absent.7z"))
	if err != nil {
		t.Fatal(err)
	}
	if !run.Failed || run.ExitCode == 0 || run.Message == "" {
		t.Fatalf("unexpected run %+v", run)
	}
}

func TestFallsBackFrom7zzTo7z(t *testing.T) {
	dir := t.TempDir()
	script := "#!/bin/sh\necho \"fallback $1\"\n"
	if err := os.WriteFile(filepath.Join(dir, "7z"), []byte(script), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	tool := sevenzip.New("7zz")
	for range 2 {
		run, err := tool.List(t.Context(), "archive.7z")
		if err != nil {
			t.Fatal(err)
		}
		if run.Failed || run.Stdout != "fallback l\n" {
			t.Fatalf("unexpected run %+v", run)
		}
	}
	if _, err := sevenzip.New("missing-archiver").List(t.Context(), "archive.7z"); !errors.Is(err, exec.ErrNotFound) {
		t.Fatalf("only 7zz falls back: %v", err)
	}
}
