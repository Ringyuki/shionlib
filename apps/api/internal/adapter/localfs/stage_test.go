package localfs_test

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/japanese"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
)

var _ composition.Stage = (*localfs.Stage)(nil)

func put(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func read(t *testing.T, path string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func asSevenZipWrites(t *testing.T, name string) string {
	t.Helper()
	raw, err := japanese.ShiftJIS.NewEncoder().String(name)
	if err != nil {
		t.Fatal(err)
	}
	shown, err := charmap.CodePage437.NewDecoder().String(raw)
	if err != nil {
		t.Fatal(err)
	}
	return shown
}

func asStored(t *testing.T, name string) string {
	t.Helper()
	raw, err := japanese.ShiftJIS.NewEncoder().String(name)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func asSevenZipEscapes(t *testing.T, name string) string {
	t.Helper()
	raw, err := japanese.ShiftJIS.NewEncoder().String(name)
	if err != nil {
		t.Fatal(err)
	}
	shown := []rune{}
	for _, value := range []byte(raw) {
		if value >= 0x80 {
			shown = append(shown, rune(0xEF00)+rune(value))
			continue
		}
		shown = append(shown, rune(value))
	}
	return string(shown)
}

func TestStageKeepsEachCompositionInItsOwnFolder(t *testing.T) {
	ctx := t.Context()
	root := filepath.Join(t.TempDir(), "spool", ".compose")
	stage := localfs.NewStage(root)
	if dirs, err := stage.Dirs(ctx); err != nil || len(dirs) != 0 {
		t.Fatalf("before anything is staged: %v %v", dirs, err)
	}
	seven, err := stage.Open(ctx, 7)
	if err != nil || seven != filepath.Join(root, "7") {
		t.Fatalf("open: %s %v", seven, err)
	}
	if _, err := stage.Open(ctx, 12); err != nil {
		t.Fatal(err)
	}
	put(t, filepath.Join(root, "notes.txt"), "not a stage")
	if dirs, _ := stage.Dirs(ctx); !slices.Equal(dirs, []int{12, 7}) && !slices.Equal(dirs, []int{7, 12}) {
		t.Fatalf("dirs: %v", dirs)
	}

	work := filepath.Join(seven, "work")
	put(t, filepath.Join(work, "tree", "game", "Game", "a.bin"), "aaaa")
	put(t, filepath.Join(work, "tree", "game", "Game", "data", "b.bin"), "bb")
	put(t, filepath.Join(seven, "inputs", "patch", "patch.zip"), "zip")
	nodes, err := stage.Tree(ctx, filepath.Join(work, "tree", "game"))
	want := []composition.Node{{Path: "Game", Dir: true}, {Path: "Game/a.bin", Size: 4}, {Path: "Game/data", Dir: true}, {Path: "Game/data/b.bin", Size: 2}}
	if err != nil || !slices.Equal(nodes, want) {
		t.Fatalf("tree: %+v %v", nodes, err)
	}
	if size, err := stage.Size(ctx, work); err != nil || size != 6 {
		t.Fatalf("size of a folder: %d %v", size, err)
	}
	if size, err := stage.Size(ctx, filepath.Join(seven, "inputs", "patch", "patch.zip")); err != nil || size != 3 {
		t.Fatalf("size of a file: %d %v", size, err)
	}

	put(t, filepath.Join(work, "tree", "patch", "new.bin"), "patched")
	if err := stage.Move(ctx, filepath.Join(work, "tree", "patch", "new.bin"), filepath.Join(work, "tree", "game", "Game", "a.bin")); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(work, "tree", "game", "Game", "a.bin")) != "patched" {
		t.Fatal("a moved file takes the place of the one that was there")
	}
	if err := stage.Move(ctx, filepath.Join(work, "tree", "game", "Game"), filepath.Join(work, "out", "ゲーム")); err != nil || read(t, filepath.Join(work, "out", "ゲーム", "data", "b.bin")) != "bb" {
		t.Fatalf("a folder moves with what it holds: %v", err)
	}
	backup := filepath.Join(work, "out", "汉化补丁", "patch.zip")
	if err := stage.Link(ctx, filepath.Join(seven, "inputs", "patch", "patch.zip"), backup); err != nil || read(t, backup) != "zip" {
		t.Fatalf("link: %v", err)
	}
	if err := stage.Clear(ctx, work); err != nil {
		t.Fatal(err)
	}
	if left, _ := stage.Tree(ctx, work); len(left) != 0 || read(t, filepath.Join(seven, "inputs", "patch", "patch.zip")) != "zip" {
		t.Fatalf("clearing the work leaves the inputs: %+v", left)
	}
	if err := stage.Discard(ctx, seven); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(seven); !os.IsNotExist(err) {
		t.Fatalf("discarded: %v", err)
	}

	outside := filepath.Join(t.TempDir(), "elsewhere")
	put(t, filepath.Join(outside, "x"), "x")
	for name, err := range map[string]error{
		"remove": stage.Remove(ctx, outside),
		"clear":  stage.Clear(ctx, outside),
		"move":   stage.Move(ctx, filepath.Join(outside, "x"), filepath.Join(root, "12", "x")),
		"link":   stage.Link(ctx, filepath.Join(outside, "x"), filepath.Join(root, "12", "y")),
		"sweep":  stage.Sweep(ctx, outside, ""),
		"root":   stage.Remove(ctx, root),
	} {
		if err == nil {
			t.Fatalf("%s reaches outside the stage", name)
		}
	}
	if _, err := stage.Tree(ctx, outside); err == nil {
		t.Fatal("listing outside the stage")
	}
	if read(t, filepath.Join(outside, "x")) != "x" {
		t.Fatal("nothing outside is touched")
	}
}

func TestSweepLeavesOnlyFilesAndFoldersUnderTheirRealNames(t *testing.T) {
	ctx := t.Context()
	root := filepath.Join(t.TempDir(), ".compose")
	stage := localfs.NewStage(root)
	dir, err := stage.Open(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	tree := filepath.Join(dir, "tree")
	secret := filepath.Join(t.TempDir(), "secret.txt")
	put(t, secret, "secret")
	put(t, filepath.Join(tree, asSevenZipWrites(t, "ゲーム"), asSevenZipWrites(t, "セーブ.dat")), "save")
	put(t, filepath.Join(tree, asSevenZipWrites(t, "ゲーム"), "readme.txt"), "ascii")
	put(t, filepath.Join(tree, asSevenZipEscapes(t, "ソフト"), asSevenZipEscapes(t, "表.txt")), "escaped")
	put(t, filepath.Join(tree, `win\style\file.txt`), "windows")
	put(t, filepath.Join(tree, "locked", "inner.bin"), "locked")
	if err := os.Symlink(secret, filepath.Join(tree, "escape")); err != nil {
		t.Skip("symbolic links cannot be created here")
	}
	if err := os.Chmod(filepath.Join(tree, "locked", "inner.bin"), 0o400); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filepath.Join(tree, "locked"), 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(tree, "locked"), 0o700) })

	if err := stage.Sweep(ctx, tree, "shift_jis"); err != nil {
		t.Fatal(err)
	}
	nodes, err := stage.Tree(ctx, tree)
	if err != nil {
		t.Fatal(err)
	}
	names := make([]string, len(nodes))
	for i, node := range nodes {
		names[i] = node.Path
	}
	slices.Sort(names)
	want := []string{"locked", "locked/inner.bin", "win", "win/style", "win/style/file.txt", "ゲーム", "ゲーム/readme.txt", "ゲーム/セーブ.dat", "ソフト", "ソフト/表.txt"}
	slices.Sort(want)
	if !slices.Equal(names, want) {
		t.Fatalf("after the sweep: %v", names)
	}
	if read(t, filepath.Join(tree, "ゲーム", "セーブ.dat")) != "save" || read(t, filepath.Join(tree, "win", "style", "file.txt")) != "windows" {
		t.Fatal("renamed files keep their content")
	}
	if _, err := os.Lstat(filepath.Join(tree, "escape")); !os.IsNotExist(err) {
		t.Fatal("a link is removed")
	}
	if read(t, secret) != "secret" {
		t.Fatal("what a link pointed to is left alone")
	}
	if err := stage.Move(ctx, filepath.Join(tree, "locked", "inner.bin"), filepath.Join(tree, "moved.bin")); err != nil {
		t.Fatalf("what came out read-only can be moved: %v", err)
	}

	plain := filepath.Join(dir, "plain")
	put(t, filepath.Join(plain, "Ünïcödé.txt"), "kept")
	put(t, filepath.Join(plain, "日本語.txt"), "kept")
	if err := stage.Sweep(ctx, plain, "utf-8"); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(plain, "Ünïcödé.txt")) != "kept" || read(t, filepath.Join(plain, "日本語.txt")) != "kept" {
		t.Fatal("names that were never legacy are left as they are")
	}
	if err := stage.Sweep(ctx, plain, "shift_jis"); err != nil || read(t, filepath.Join(plain, "日本語.txt")) != "kept" {
		t.Fatalf("a name outside the legacy table is left as it is: %v", err)
	}
}

func TestSweepReadsNamesKeptAsTheArchiveStoredThem(t *testing.T) {
	ctx := t.Context()
	stage := localfs.NewStage(filepath.Join(t.TempDir(), ".compose"))
	dir, err := stage.Open(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	tree := filepath.Join(dir, "tree")
	game := filepath.Join(tree, asStored(t, "ゲーム"))
	if err := os.MkdirAll(game, 0o750); err != nil {
		t.Skip("this file system takes only Unicode names")
	}
	put(t, filepath.Join(game, asStored(t, "セーブ.dat")), "save")
	put(t, filepath.Join(game, asStored(t, "ソフト"), asStored(t, "表.txt")), "backslash bytes")
	if err := stage.Sweep(ctx, tree, "shift_jis"); err != nil {
		t.Fatal(err)
	}
	if read(t, filepath.Join(tree, "ゲーム", "セーブ.dat")) != "save" || read(t, filepath.Join(tree, "ゲーム", "ソフト", "表.txt")) != "backslash bytes" {
		t.Fatal("names whose bytes are not Unicode are read in the archive's encoding, backslash bytes included")
	}
}
