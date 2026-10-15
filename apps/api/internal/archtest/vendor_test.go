package archtest

import (
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

var sealedVendors = map[string][]string{
	"idatariver": {"internal/adapter/idatariver/", "internal/bootstrap/", "cmd/devtool/"},
	"animetrace": {"internal/adapter/animetrace/", "internal/bootstrap/"},
}

var unscannedForVendors = []string{"internal/archtest/", "migrations/"}

func TestVendorsAreNamedOnlyByTheirAdapters(t *testing.T) {
	root := moduleRoot(t)
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		if entry.IsDir() {
			if entry.Name() == "testdata" || strings.HasPrefix(entry.Name(), ".") && rel != "." {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(rel, ".go") || slices.ContainsFunc(unscannedForVendors, func(prefix string) bool { return strings.HasPrefix(rel, prefix) }) {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		source := strings.ToLower(string(raw))
		for vendor, homes := range sealedVendors {
			if !strings.Contains(source, vendor) || slices.ContainsFunc(homes, func(home string) bool { return strings.HasPrefix(rel, home) }) {
				continue
			}
			t.Errorf("%s names the vendor %q; a vendor is known by name only to its adapter and the composition root, and everything else goes through the port its adapter fills (sponsor.Provider, search.Recognizer)", rel, vendor)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
