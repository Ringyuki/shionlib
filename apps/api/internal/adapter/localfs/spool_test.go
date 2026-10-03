package localfs_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

var (
	_ upload.Spool        = (*localfs.Spool)(nil)
	_ download.LocalFiles = (*localfs.Spool)(nil)
	_ scan.LocalFiles     = (*localfs.Spool)(nil)
)

func sha(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func TestAllocateCreatesSparseFileOfExactSize(t *testing.T) {
	root := filepath.Join(t.TempDir(), "nested", "upload")
	spool := localfs.NewSpool(root, ".sltf")
	path := spool.Path("12")
	if path != filepath.Join(root, "12.sltf") {
		t.Fatalf("unexpected path %s", path)
	}
	if err := spool.Allocate(t.Context(), path, 10<<20); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != 10<<20 {
		t.Fatalf("size %d", info.Size())
	}
	if err := spool.Allocate(t.Context(), path, 3); err != nil {
		t.Fatal(err)
	}
	if info, _ := os.Stat(path); info.Size() != 3 {
		t.Fatalf("reallocation must truncate: %d", info.Size())
	}
}

func TestWriteHashesAndPlacesBytesAtOffset(t *testing.T) {
	spool := localfs.NewSpool(t.TempDir(), ".sltf")
	path := spool.Path("1")
	if err := spool.Allocate(t.Context(), path, 12); err != nil {
		t.Fatal(err)
	}
	second := []byte("world!")
	got, err := spool.Write(t.Context(), path, 6, bytes.NewReader(append(slices.Clone(second), []byte("extra")...)), int64(len(second)))
	if err != nil {
		t.Fatal(err)
	}
	if got != sha(second) {
		t.Fatalf("digest %s", got)
	}
	first := []byte("hello ")
	if _, err := spool.Write(t.Context(), path, 0, bytes.NewReader(first), int64(len(first))); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "hello world!" {
		t.Fatalf("content %q", content)
	}
	ranged, err := spool.DigestRange(t.Context(), path, 6, 6)
	if err != nil || ranged != sha(second) {
		t.Fatalf("range digest %s %v", ranged, err)
	}
}

func TestWriteRejectsShortBodies(t *testing.T) {
	spool := localfs.NewSpool(t.TempDir(), ".sltf")
	path := spool.Path("1")
	if err := spool.Allocate(t.Context(), path, 10); err != nil {
		t.Fatal(err)
	}
	_, err := spool.Write(t.Context(), path, 0, strings.NewReader("abc"), 10)
	if !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("short body: %v", err)
	}
	if _, err := spool.Write(t.Context(), spool.Path("missing"), 0, strings.NewReader("abc"), 3); err == nil {
		t.Fatal("writing a missing file must fail")
	}
}

func TestDigestUsesBLAKE3(t *testing.T) {
	spool := localfs.NewSpool(t.TempDir(), ".sltf")
	cases := map[string]string{
		"":    "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
		"abc": "6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85",
	}
	for input, want := range cases {
		path := spool.Path("d" + input)
		if err := os.WriteFile(path, []byte(input), 0o600); err != nil {
			t.Fatal(err)
		}
		got, err := spool.Digest(t.Context(), path)
		if err != nil || got != want {
			t.Fatalf("blake3(%q) = %s %v", input, got, err)
		}
	}
}

func TestOwns(t *testing.T) {
	root := filepath.Join(t.TempDir(), "upload")
	spool := localfs.NewSpool(root+"/", ".sltf")
	cases := map[string]bool{
		filepath.Join(root, "1.sltf"):            true,
		filepath.Join(root, "sub", "2.sltf"):     true,
		root:                                     false,
		root + "/":                               false,
		root + "-other/1.sltf":                   false,
		filepath.Join(root, "..", "escape.sltf"): false,
		root + "/../upload/../../etc/passwd":     false,
		"":                                       false,
		"relative/1.sltf":                        false,
		filepath.Join(root, "a", "..", "inside.sltf"): true,
	}
	for path, want := range cases {
		if got := spool.Owns(path); got != want {
			t.Errorf("Owns(%q) = %v want %v", path, got, want)
		}
	}
}

func TestRemoveExistsAndStale(t *testing.T) {
	root := t.TempDir()
	spool := localfs.NewSpool(root, ".sltf")
	old := spool.Path("old")
	fresh := spool.Path("fresh")
	other := filepath.Join(root, "notes.txt")
	for _, path := range []string{old, fresh, other} {
		if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(root, "dir.sltf"), 0o750); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-72 * time.Hour)
	for _, path := range []string{old, other} {
		if err := os.Chtimes(path, past, past); err != nil {
			t.Fatal(err)
		}
	}
	stale, err := spool.Stale(t.Context(), time.Now().Add(-48*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(stale, []string{old}) {
		t.Fatalf("stale %v", stale)
	}
	if exists, err := spool.Exists(t.Context(), old); err != nil || !exists {
		t.Fatalf("exists %v %v", exists, err)
	}
	if err := spool.Remove(t.Context(), old); err != nil {
		t.Fatal(err)
	}
	if err := spool.Remove(t.Context(), old); err != nil {
		t.Fatalf("removing twice must be a no-op: %v", err)
	}
	if exists, err := spool.Exists(t.Context(), old); err != nil || exists {
		t.Fatalf("exists after remove %v %v", exists, err)
	}
	missing := localfs.NewSpool(filepath.Join(root, "absent"), ".sltf")
	if stale, err := missing.Stale(t.Context(), time.Now()); err != nil || stale != nil {
		t.Fatalf("missing root %v %v", stale, err)
	}
}
