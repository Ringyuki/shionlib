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
}

var unscannedForVendors = []string{"internal/archtest/", "migrations/"}

func TestPaymentVendorsAreNamedOnlyByTheirAdapters(t *testing.T) {
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
			t.Errorf("%s names the payment vendor %q; a payment provider is known by name only to its adapter, the composition root and the seeder, and everything else goes through sponsor.Provider", rel, vendor)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
