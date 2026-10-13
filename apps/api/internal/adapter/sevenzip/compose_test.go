package sevenzip_test

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
)

var _ composition.Archiver = (*sevenzip.Tool)(nil)

func TestUnpackWritesEveryFileOfAnArchive(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	write(t, filepath.Join(dir, "src"), map[string]string{"Game/game.exe": "program", "Game/data/script.pak": "script", "Game/空のフォルダ/メモ.txt": "memo"})
	packed := archive(t, binary, filepath.Join(dir, "src"), "game.7z", nil, "Game")
	tool := sevenzip.New(binary)
	seen := []int{}
	target := filepath.Join(dir, "out")
	if err := tool.Unpack(t.Context(), composition.Unpacking{Archive: packed, Destination: target, Threads: 2}, func(percent int) { seen = append(seen, percent) }); err != nil {
		t.Fatal(err)
	}
	if content(t, filepath.Join(target, "Game", "game.exe")) != "program" || content(t, filepath.Join(target, "Game", "data", "script.pak")) != "script" || content(t, filepath.Join(target, "Game", "空のフォルダ", "メモ.txt")) != "memo" {
		t.Fatal("every file comes out under its folder")
	}
	if !slices.IsSorted(seen) {
		t.Fatalf("progress only grows: %v", seen)
	}
}

func TestLegacyNamesAreReadableOnceTheStageHasSweptThem(t *testing.T) {
	binary := installedBinary(t)
	root := filepath.Join(t.TempDir(), ".compose")
	stage := localfs.NewStage(root)
	dir, err := stage.Open(t.Context(), 1)
	if err != nil {
		t.Fatal(err)
	}
	packed := filepath.Join(dir, "legacy.zip")
	legacyZip(t, packed, map[string]string{"ゲーム/セーブ.dat": "save", "ゲーム/ソフト/表.txt": "backslash bytes", "readme.txt": "plain"})
	target := filepath.Join(dir, "out")
	if err := sevenzip.New(binary).Unpack(t.Context(), composition.Unpacking{Archive: packed, Destination: target}, func(int) {}); err != nil {
		t.Fatal(err)
	}
	if err := stage.Sweep(t.Context(), target, "shift_jis"); err != nil {
		t.Fatal(err)
	}
	if content(t, filepath.Join(target, "ゲーム", "セーブ.dat")) != "save" || content(t, filepath.Join(target, "readme.txt")) != "plain" {
		t.Fatal("names written in Shift_JIS are readable after the sweep")
	}
	if content(t, filepath.Join(target, "ゲーム", "ソフト", "表.txt")) != "backslash bytes" {
		t.Fatal("a character whose second byte is a backslash stays one character")
	}
}

func TestUnpackTellsAnArchiveThatCannotBeRead(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	write(t, dir, map[string]string{"a.txt": strings.Repeat("payload", 4096)})
	packed := archive(t, binary, dir, "broken.7z", nil, "a.txt")
	raw, err := os.ReadFile(packed)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(packed, raw[:len(raw)/2], 0o600); err != nil {
		t.Fatal(err)
	}
	err = sevenzip.New(binary).Unpack(t.Context(), composition.Unpacking{Archive: packed, Destination: filepath.Join(dir, "out")}, func(int) {})
	if !errors.Is(err, composition.ErrUnreadable) {
		t.Fatalf("a truncated archive: %v", err)
	}
	locked := archive(t, binary, dir, "locked.7z", []string{"-pSECRET"}, "a.txt")
	err = sevenzip.New(binary).Unpack(t.Context(), composition.Unpacking{Archive: locked, Destination: filepath.Join(dir, "locked")}, func(int) {})
	if !errors.Is(err, composition.ErrUnreadable) {
		t.Fatalf("an encrypted archive: %v", err)
	}
}

func TestUnpackKeepsLinksFromLeadingOutOfTheFolder(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	write(t, dir, map[string]string{"secret.txt": "secret", "src/Game/a.txt": "a"})
	if err := os.Symlink("../../secret.txt", filepath.Join(dir, "src", "Game", "escape")); err != nil {
		t.Skip("symbolic links cannot be created here")
	}
	packed := archive(t, binary, filepath.Join(dir, "src"), "links.7z", []string{"-snl"}, "Game")
	target := filepath.Join(dir, "out")
	if err := sevenzip.New(binary).Unpack(t.Context(), composition.Unpacking{Archive: packed, Destination: target}, func(int) {}); err != nil {
		t.Fatalf("a link that is refused does not fail the whole archive: %v", err)
	}
	if content(t, filepath.Join(target, "Game", "a.txt")) != "a" {
		t.Fatal("the other files come out")
	}
	if raw, err := os.ReadFile(filepath.Join(target, "Game", "escape")); err == nil && string(raw) == "secret" {
		t.Fatal("the link must not lead to a file outside the folder")
	}
}

func TestPackWritesAPlain7zOfTheNamedFolders(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	root := filepath.Join(dir, "out")
	write(t, dir, map[string]string{"outside.txt": "outside"})
	write(t, root, map[string]string{
		"ゲーム/game.exe":      "program",
		"ゲーム/data/a.pak":    strings.Repeat("a", 20000),
		"全CG存档/save.dat":    "save",
		"-odd/starts.txt":   "dash",
		"@list/starts.txt":  "at",
		"left out/skip.txt": "skip",
	})
	_ = os.Symlink(filepath.Join(dir, "outside.txt"), filepath.Join(root, "ゲーム", "link"))
	target := filepath.Join(dir, "work", "result.7z")
	if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
		t.Fatal(err)
	}
	tool := sevenzip.New(binary)
	if err := tool.Pack(t.Context(), composition.Packing{Root: root, Entries: []string{"ゲーム", "全CG存档", "-odd", "@list"}, Target: target, Threads: 2}, func(int) {}); err != nil {
		t.Fatal(err)
	}
	found, err := scan.InspectArchive(t.Context(), tool, target)
	if err != nil || found.Status != download.CheckOK || !found.Verified || found.Facts.Format != "7z" || found.Facts.Solid {
		t.Fatalf("the result is a sound 7z that is not solid: %+v %v", found.Facts, err)
	}
	names := []string{}
	for _, entry := range found.Entries {
		if !entry.Folder {
			names = append(names, entry.Path)
		}
	}
	slices.Sort(names)
	want := []string{"-odd/starts.txt", "@list/starts.txt", "ゲーム/data/a.pak", "ゲーム/game.exe", "ゲーム/link", "全CG存档/save.dat"}
	if _, err := os.Lstat(filepath.Join(root, "ゲーム", "link")); err != nil {
		want = slices.DeleteFunc(want, func(name string) bool { return name == "ゲーム/link" })
	}
	if !slices.Equal(names, want) {
		t.Fatalf("only the named folders are packed, by their names: %v", names)
	}
	listing, err := exec.CommandContext(t.Context(), binary, "l", "-slt", target).Output()
	if err != nil || !strings.Contains(string(listing), "Method = LZMA2") {
		t.Fatalf("the method every unpacker knows: %v", err)
	}
	extracted := filepath.Join(dir, "again")
	if err := tool.Unpack(t.Context(), composition.Unpacking{Archive: target, Destination: extracted}, func(int) {}); err != nil {
		t.Fatal(err)
	}
	if raw, err := os.ReadFile(filepath.Join(extracted, "ゲーム", "link")); err == nil && string(raw) == "outside" {
		t.Fatal("a link is packed as a link, never as the file it leads to")
	}
	if err := tool.Pack(t.Context(), composition.Packing{Root: root, Entries: []string{"missing"}, Target: filepath.Join(dir, "work", "none.7z")}, func(int) {}); err == nil {
		t.Fatal("a folder that is not there fails the packing")
	}
}
