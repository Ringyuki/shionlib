package localfs_test

import (
	"io"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ scan.Workspace = (*localfs.Workspace)(nil)

func TestWorkspaceLinksListsAndDiscards(t *testing.T) {
	ctx := t.Context()
	spool := t.TempDir()
	source := filepath.Join(spool, "12.sltf")
	if err := os.WriteFile(source, []byte("volume"), 0o600); err != nil {
		t.Fatal(err)
	}
	workspaces := localfs.NewWorkspace(filepath.Join(spool, ".work"))
	dir, err := workspaces.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	linked := filepath.Join(dir, "volumes", "ゲーム.part1.rar")
	if err := workspaces.Link(ctx, source, linked); err != nil {
		t.Fatal(err)
	}
	if err := workspaces.Link(ctx, source, filepath.Join(spool, "escape.rar")); err == nil {
		t.Fatal("links must stay inside the workspace")
	}
	if err := os.MkdirAll(filepath.Join(dir, "contents", "bin"), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "contents", "bin", "setup.exe"), []byte("mz"), 0o600); err != nil {
		t.Fatal(err)
	}
	files, err := workspaces.Files(ctx, filepath.Join(dir, "contents"))
	if err != nil || !slices.Equal(files, []string{filepath.Join(dir, "contents", "bin", "setup.exe")}) {
		t.Fatalf("files: %v %v", files, err)
	}
	if missing, err := workspaces.Files(ctx, filepath.Join(dir, "missing")); err != nil || len(missing) != 0 {
		t.Fatalf("a directory that was never written lists nothing: %v %v", missing, err)
	}
	content, err := workspaces.Open(ctx, linked)
	if err != nil {
		t.Fatal(err)
	}
	read, _ := io.ReadAll(content)
	_ = content.Close()
	if string(read) != "volume" {
		t.Fatalf("linked content %q", read)
	}
	if err := workspaces.Discard(ctx, spool); err == nil {
		t.Fatal("only workspace directories can be discarded")
	}
	if err := workspaces.Discard(ctx, dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("workspace removed: %v", err)
	}
	if _, err := os.Stat(source); err != nil {
		t.Fatalf("the spool file survives the workspace: %v", err)
	}
}
