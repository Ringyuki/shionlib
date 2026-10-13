package zipnames_test

import (
	"archive/zip"
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/simplifiedchinese"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/zipnames"
)

type entry struct {
	name   string
	target encoding.Encoding
}

func archive(t *testing.T, entries ...entry) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "names.zip")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	for _, e := range entries {
		header := &zip.FileHeader{Name: e.name, Method: zip.Store}
		if e.target != nil {
			raw, err := e.target.NewEncoder().String(e.name)
			if err != nil {
				t.Fatal(err)
			}
			header.Name, header.NonUTF8 = raw, true
		}
		if _, err := writer.CreateHeader(header); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestLegacyNamesDecodesNamesStoredInAJapaneseCodePage(t *testing.T) {
	path := archive(t,
		entry{"ゲーム/", japanese.ShiftJIS},
		entry{"ゲーム/readme.txt", japanese.ShiftJIS},
		entry{"ゲーム/セーブデータ/予約特典.dat", japanese.ShiftJIS},
		entry{"setup.exe", nil},
	)
	got, err := zipnames.NewReader().LegacyNames(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"ゲーム/", "ゲーム/readme.txt", "ゲーム/セーブデータ/予約特典.dat", "setup.exe"}
	if got.Encoding != "shift_jis" || !slices.Equal(got.Names, want) {
		t.Fatalf("unexpected names %+v", got)
	}
}

func TestLegacyNamesDecodesNamesStoredInAChineseCodePage(t *testing.T) {
	path := archive(t, entry{"汉化补丁/使用说明.txt", simplifiedchinese.GBK}, entry{"汉化补丁/游戏本体.exe", simplifiedchinese.GBK})
	got, err := zipnames.NewReader().LegacyNames(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	if got.Encoding != "gbk" || !slices.Equal(got.Names, []string{"汉化补丁/使用说明.txt", "汉化补丁/游戏本体.exe"}) {
		t.Fatalf("unexpected names %+v", got)
	}
}

func TestLegacyNamesLeavesUnicodeArchivesAlone(t *testing.T) {
	path := archive(t, entry{"ゲーム/readme.txt", nil}, entry{"setup.exe", nil})
	got, err := zipnames.NewReader().LegacyNames(context.Background(), path)
	if err != nil || got.Encoding != "" || got.Names != nil {
		t.Fatalf("unexpected names %+v %v", got, err)
	}
}

func TestLegacyNamesHasNothingToSayAboutWhatIsNotAZip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "volume.z01")
	if err := os.WriteFile(path, []byte("PK\x07\x08 not a whole zip"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := zipnames.NewReader().LegacyNames(context.Background(), path)
	if err != nil || got.Encoding != "" || got.Names != nil {
		t.Fatalf("unexpected names %+v %v", got, err)
	}
}

func TestLegacyNamesReportsAFileThatCannotBeOpened(t *testing.T) {
	if _, err := zipnames.NewReader().LegacyNames(context.Background(), filepath.Join(t.TempDir(), "missing.zip")); err == nil {
		t.Fatal("expected a failure")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := zipnames.NewReader().LegacyNames(ctx, "any.zip"); err == nil {
		t.Fatal("a cancelled request must stop")
	}
}
