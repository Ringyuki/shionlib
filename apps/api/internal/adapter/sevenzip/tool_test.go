package sevenzip_test

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"errors"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/japanese"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/discimage"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/zipnames"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan/scantest"
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
		if got.Status != want {
			t.Errorf("%s classified %d, want %d", filepath.Base(path), got.Status, want)
		}
	}
	listed, err := scan.InspectArchive(t.Context(), tool, valid)
	slices.SortFunc(listed.Entries, func(a, b scan.ArchiveEntry) int { return strings.Compare(a.Path, b.Path) })
	for i := range listed.Entries {
		listed.Entries[i].Modified = nil
	}
	if err != nil || !slices.Equal(listed.Entries, []scan.ArchiveEntry{{Path: "data.bin", Size: 64 << 10}, {Path: "readme.txt", Size: 6}}) {
		t.Fatalf("entries with their sizes: %+v %v", listed.Entries, err)
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

func TestExtractTakesOnlyMatchingEntriesFromSplitArchives(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	payload := make([]byte, 256<<10)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "game", "bin"), 0o750); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string][]byte{"game/bin/SETUP.EXE": payload, "game/readme.txt": []byte("hi"), "game/data.pak": payload} {
		if err := os.WriteFile(filepath.Join(dir, filepath.FromSlash(name)), content, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	archive(t, binary, dir, "set.7z", []string{"-v100k", "-mx0"}, "game")
	destination := filepath.Join(dir, "out")
	run, err := sevenzip.New(binary).Extract(t.Context(), filepath.Join(dir, "set.7z.001"), destination, scan.Selection{Extensions: []string{"exe", "dll"}})
	if err != nil || run.Failed {
		t.Fatalf("extract: %+v %v", run, err)
	}
	var extracted []string
	err = filepath.WalkDir(destination, func(path string, entry os.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			rel, _ := filepath.Rel(destination, path)
			extracted = append(extracted, filepath.ToSlash(rel))
		}
		return err
	})
	if err != nil || len(extracted) != 1 || extracted[0] != "game/bin/SETUP.EXE" {
		t.Fatalf("only executables are extracted, whatever their case: %v %v", extracted, err)
	}
	empty := filepath.Join(dir, "none")
	if run, err := sevenzip.New(binary).Extract(t.Context(), filepath.Join(dir, "set.7z.001"), empty, scan.Selection{Extensions: []string{"vbs"}}); err != nil || run.Failed {
		t.Fatalf("an archive without matching entries extracts nothing without failing: %+v %v", run, err)
	}
	skipped := filepath.Join(dir, "skipped")
	if run, err := sevenzip.New(binary).Extract(t.Context(), filepath.Join(dir, "set.7z.001"), skipped, scan.Selection{Extensions: []string{"exe"}, Skip: []string{"game/bin/SETUP.EXE"}}); err != nil || run.Failed {
		t.Fatalf("extract with a skipped entry: %+v %v", run, err)
	}
	if _, err := os.Stat(filepath.Join(skipped, "game", "bin", "SETUP.EXE")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("a skipped entry is not extracted: %v", err)
	}
	named := filepath.Join(dir, "named")
	if run, err := sevenzip.New(binary).Extract(t.Context(), filepath.Join(dir, "set.7z.001"), named, scan.Selection{Extensions: []string{"exe"}, Paths: []string{"game/readme.txt"}}); err != nil || run.Failed {
		t.Fatalf("extract with a named entry: %+v %v", run, err)
	}
	for _, name := range []string{"game/readme.txt", "game/bin/SETUP.EXE"} {
		if _, err := os.Stat(filepath.Join(named, filepath.FromSlash(name))); err != nil {
			t.Fatalf("%s must be extracted beside what the extensions select: %v", name, err)
		}
	}
	if _, err := os.Stat(filepath.Join(named, "game", "data.pak")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("an entry nothing selects is not extracted: %v", err)
	}
}

func TestInspectArchiveReadsTheFactsAndEntriesOfARealArchive(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "ゲーム", "セーブ"), 0o750); err != nil {
		t.Fatal(err)
	}
	modified := time.Date(2013, 7, 27, 4, 0, 0, 0, time.UTC)
	for name, content := range map[string]string{"ゲーム/readme.txt": "hello", "ゲーム/セーブ/save01.dat": "save"} {
		path := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, modified, modified); err != nil {
			t.Fatal(err)
		}
	}
	solid := archive(t, binary, dir, "solid.7z", []string{"-ms=on"}, "ゲーム")
	got, err := scan.InspectArchive(t.Context(), sevenzip.New(binary), solid)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != download.CheckOK || !got.Verified || got.Facts.Format != "7z" || !got.Facts.Solid || got.Facts.Recovery {
		t.Fatalf("unexpected archive %+v", got)
	}
	byPath := map[string]scan.ArchiveEntry{}
	for _, entry := range got.Entries {
		byPath[entry.Path] = entry
	}
	readme, save := byPath["ゲーム/readme.txt"], byPath["ゲーム/セーブ/save01.dat"]
	if readme.Size != 5 || readme.Folder || readme.Encrypted || readme.Modified == nil || !readme.Modified.Equal(modified) {
		t.Fatalf("unexpected file entry %+v", readme)
	}
	if save.Size != 4 || !byPath["ゲーム/セーブ"].Folder || !byPath["ゲーム"].Folder {
		t.Fatalf("unexpected entries %+v", got.Entries)
	}
	zipped := archive(t, binary, dir, "plain.zip", nil, "ゲーム")
	if got, err := scan.InspectArchive(t.Context(), sevenzip.New(binary), zipped); err != nil || got.Facts.Format != "zip" || got.Facts.Solid || len(got.Entries) != 4 {
		t.Fatalf("unexpected zip %+v %v", got, err)
	}
	inner := archive(t, binary, dir, "outer.7z", nil, "plain.zip")
	nested, err := scan.InspectNested(t.Context(), sevenzip.New(binary), inner)
	if err != nil || nested.Status != download.CheckOK || nested.Verified || len(nested.Entries) != 1 || nested.Entries[0].Path != "plain.zip" {
		t.Fatalf("a nested archive is listed without being tested: %+v %v", nested, err)
	}
}

func write(t *testing.T, root string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func legacyZip(t *testing.T, path string, files map[string]string) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	slices.Sort(names)
	for _, name := range names {
		raw, err := japanese.ShiftJIS.NewEncoder().String(name)
		if err != nil {
			t.Fatal(err)
		}
		entry, err := writer.CreateHeader(&zip.FileHeader{Name: raw, NonUTF8: true, Method: zip.Deflate})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(files[name])); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func paths(draft inspection.Draft) []string {
	out := make([]string, len(draft.Entries))
	for i, entry := range draft.Entries {
		name := entry.Name
		for parent := entry.Parent; parent != inspection.TopLevel; parent = draft.Entries[parent].Parent {
			name = draft.Entries[parent].Name + "/" + name
		}
		out[i] = string(entry.Kind) + " " + name
	}
	slices.Sort(out)
	return out
}

func readContents(t *testing.T, binary, dir, target string) (scan.Contents, string) {
	t.Helper()
	tool := sevenzip.New(binary)
	inspected, err := scan.InspectArchive(t.Context(), tool, target)
	if err != nil {
		t.Fatal(err)
	}
	workspace := localfs.NewWorkspace(filepath.Join(dir, "work"))
	work, err := workspace.Create(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	contents, err := scan.NewContentService(scan.ContentDeps{Archives: tool, Names: zipnames.NewReader(), Discs: discimage.NewReader(), Workspace: workspace, Spool: &scantest.Spool{Room: 1 << 30}, Scanner: &scantest.Scanner{Limit: 1 << 20}}).
		Read(t.Context(), scan.Source{Path: target, Workspace: work, Archive: inspected})
	if err != nil {
		t.Fatal(err)
	}
	return contents, work
}

func content(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestContentsOfARealArchiveAreReadThroughItsNestedArchives(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	source := filepath.Join(dir, "source")
	write(t, source, map[string]string{
		"Game/game.exe":         "MZ game",
		"Game/readme.txt":       "read me",
		"Game/data/voice.xp3":   "voice",
		"Game/manual/cover.png": "png",
	})
	legacyZip(t, filepath.Join(source, "Game", "特典.zip"), map[string]string{
		"特典/壁紙.txt":     "wallpaper",
		"特典/セットアップ.exe": "MZ bonus",
		"特典/設定.exe":     "MZ settings",
		"特典/起動.exe":     "MZ launch",
	})
	contents, _ := readContents(t, binary, dir, archive(t, binary, source, "game.7z", nil, "Game"))
	want := []string{
		"archive Game/特典.zip",
		"file Game/data/voice.xp3",
		"file Game/game.exe",
		"file Game/manual/cover.png",
		"file Game/readme.txt",
		"file Game/特典.zip/特典/セットアップ.exe",
		"file Game/特典.zip/特典/壁紙.txt",
		"file Game/特典.zip/特典/設定.exe",
		"file Game/特典.zip/特典/起動.exe",
		"folder Game",
		"folder Game/data",
		"folder Game/manual",
		"folder Game/特典.zip/特典",
	}
	if got := paths(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected entries:\n%s", strings.Join(got, "\n"))
	}
	scanned := map[string]string{}
	for _, target := range contents.Targets {
		scanned[target.Name] = content(t, target.Path)
	}
	wantScanned := map[string]string{
		"Game/game.exe": "MZ game",
		"Game/特典.zip/特典/セットアップ.exe": "MZ bonus",
		"Game/特典.zip/特典/設定.exe":     "MZ settings",
		"Game/特典.zip/特典/起動.exe":     "MZ launch",
	}
	for name, body := range wantScanned {
		if scanned[name] != body {
			t.Fatalf("%s must be scanned with its own bytes, got %q of %v", name, scanned[name], scanned)
		}
	}
	if _, whole := scanned["Game/特典.zip"]; !whole || len(scanned) != len(wantScanned)+1 {
		t.Fatalf("the nested archive is scanned as a file too: %v", scanned)
	}
	previews := map[string]string{}
	for _, preview := range contents.Previews {
		previews[string(preview.Kind)+" "+contents.Draft.Entries[preview.Entry].Name] = content(t, preview.Path)
	}
	wantPreviews := map[string]string{"text readme.txt": "read me", "image cover.png": "png", "text 壁紙.txt": "wallpaper"}
	if len(previews) != len(wantPreviews) {
		t.Fatalf("unexpected previews %v", previews)
	}
	for name, body := range wantPreviews {
		if previews[name] != body {
			t.Fatalf("%s must be kept with its own bytes, got %v", name, previews)
		}
	}
	if contents.NameEncoding != "" || len(contents.Skipped) != 0 {
		t.Fatalf("the outer archive stores its names in Unicode: %q %v", contents.NameEncoding, contents.Skipped)
	}
	for _, entry := range contents.Draft.Entries {
		if entry.Name == "特典.zip" && (entry.Unreadable || entry.Encrypted || entry.Detail.Format != "zip") {
			t.Fatalf("unexpected nested archive %+v", entry)
		}
	}
}

func TestContentsOfAZipWithLegacyNamesAreShownDecoded(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	target := filepath.Join(dir, "game.zip")
	legacyZip(t, target, map[string]string{"体験版/ソフト.exe": "MZ soft", "体験版/説明書.txt": "manual"})
	contents, _ := readContents(t, binary, dir, target)
	want := []string{"file 体験版/ソフト.exe", "file 体験版/説明書.txt", "folder 体験版"}
	if got := paths(contents.Draft); !slices.Equal(got, want) {
		t.Fatalf("unexpected entries:\n%s", strings.Join(got, "\n"))
	}
	if contents.NameEncoding != "shift_jis" {
		t.Fatalf("unexpected encoding %q", contents.NameEncoding)
	}
	if len(contents.Targets) != 1 || contents.Targets[0].Name != "体験版/ソフト.exe" || content(t, contents.Targets[0].Path) != "MZ soft" {
		t.Fatalf("unexpected targets %+v", contents.Targets)
	}
	if len(contents.Previews) != 1 || contents.Draft.Entries[contents.Previews[0].Entry].Name != "説明書.txt" || content(t, contents.Previews[0].Path) != "manual" {
		t.Fatalf("unexpected previews %+v", contents.Previews)
	}
}

func TestContentsMarkANestedArchiveThatAsksForAPassword(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	source := filepath.Join(dir, "source")
	write(t, source, map[string]string{"secret/readme.txt": "locked", "game.exe": "MZ"})
	archive(t, binary, source, "update.7z", []string{"-pSECRET", "-mhe=on"}, "secret")
	contents, _ := readContents(t, binary, dir, archive(t, binary, source, "outer.zip", nil, "update.7z", "game.exe"))
	if got := paths(contents.Draft); !slices.Equal(got, []string{"archive update.7z", "file game.exe"}) {
		t.Fatalf("unexpected entries:\n%s", strings.Join(got, "\n"))
	}
	for _, entry := range contents.Draft.Entries {
		if entry.Kind == inspection.KindArchive && (!entry.Encrypted || !entry.Unreadable) {
			t.Fatalf("unexpected nested archive %+v", entry)
		}
	}
}

func unicodeZip(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var out bytes.Buffer
	writer := zip.NewWriter(&out)
	names := slices.Sorted(maps.Keys(files))
	for _, name := range names {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(files[name])); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func TestContentsOfARealArchiveTakeNamesTooLongForTheDisk(t *testing.T) {
	binary := installedBinary(t)
	dir := t.TempDir()
	long := strings.Repeat("特典", 130)
	inner := unicodeZip(t, map[string]string{"voice.exe": "MZ voice"})
	target := filepath.Join(dir, "game.zip")
	if err := os.WriteFile(target, unicodeZip(t, map[string]string{
		"Game/game.exe":         "MZ game",
		"Game/" + long + ".exe": "MZ long",
		"Game/" + long + ".zip": string(inner),
	}), 0o600); err != nil {
		t.Fatal(err)
	}
	contents, _ := readContents(t, binary, dir, target)
	scanned := map[string]string{}
	for _, target := range contents.Targets {
		scanned[target.Name] = content(t, target.Path)
	}
	want := map[string]string{
		"Game/game.exe":                   "MZ game",
		"Game/" + long + ".exe":           "MZ long",
		"Game/" + long + ".zip/voice.exe": "MZ voice",
		"Game/" + long + ".zip":           string(inner),
	}
	if !maps.Equal(scanned, want) {
		t.Fatalf("entries whose names the disk cannot hold are read under their own names: %v", slices.Sorted(maps.Keys(scanned)))
	}
	if got := paths(contents.Draft); !slices.Contains(got, "file Game/"+long+".zip/voice.exe") {
		t.Fatalf("the nested archive with a long name is listed: %v", got)
	}
}
