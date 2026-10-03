package archtest

import (
	"go/ast"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

var taggedBusinessFiles = map[string]string{
	"internal/lexical/document.go": "lexical decodes the Lexical editor's JSON format; the tags are that format",
}

var rawSQLMethods = []string{"ExecContext", "QueryContext", "QueryRowContext"}

var rawSQLOwners = []string{"internal/adapter/postgres/", "internal/platform/database/"}

func isBusinessFile(rel string) bool {
	parts := strings.Split(rel, "/")
	if len(parts) != 3 || parts[0] != "internal" {
		return false
	}
	switch parts[1] {
	case "adapter", "platform", "transport", "bootstrap", "archtest":
		return false
	}
	return true
}

func TestBusinessTypesCarryNoTags(t *testing.T) {
	walkProductionFiles(t, func(rel string, file *ast.File) {
		if !isBusinessFile(rel) || path.Base(rel) == "jobs.go" {
			return
		}
		if _, ok := taggedBusinessFiles[rel]; ok {
			return
		}
		for _, decl := range file.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok {
				continue
			}
			for _, spec := range gen.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}
				tagged := false
				ast.Inspect(typeSpec.Type, func(node ast.Node) bool {
					if field, ok := node.(*ast.Field); ok && field.Tag != nil {
						tagged = true
					}
					return !tagged
				})
				if tagged {
					t.Errorf("%s: %s carries struct tags; wire and storage shapes belong to transport DTOs and adapter records, job args in jobs.go excepted", rel, typeSpec.Name.Name)
				}
			}
		}
	})
}

func TestRawSQLStaysInPostgresAdapters(t *testing.T) {
	walkProductionFiles(t, func(rel string, file *ast.File) {
		if slices.ContainsFunc(rawSQLOwners, func(prefix string) bool { return strings.HasPrefix(rel, prefix) }) {
			return
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if ok && slices.Contains(rawSQLMethods, selector.Sel.Name) {
				t.Errorf("%s calls %s; SQL is written only in internal/adapter/postgres (ADR 0003)", rel, selector.Sel.Name)
			}
			return true
		})
	})
}

var untestedPackages = map[string]string{
	"cmd/entgen":     "verify.sh regenerates ent and fails on any diff, which is the generator's test",
	"internal/patch": "declares the Clearable value type only; its semantics are tested where updates are applied (gamepg, adtest contract)",
}

func TestEveryPackageHasTests(t *testing.T) {
	root := moduleRoot(t)
	for _, base := range []string{"internal", "cmd"} {
		err := filepath.WalkDir(filepath.Join(root, base), func(path string, entry os.DirEntry, err error) error {
			if err != nil || !entry.IsDir() {
				return err
			}
			if entry.Name() == "testdata" || strings.HasSuffix(filepath.ToSlash(path), "internal/adapter/postgres/ent") {
				return filepath.SkipDir
			}
			rel, _ := filepath.Rel(root, path)
			rel = filepath.ToSlash(rel)
			if isTestSupport(rel+"/x.go") || strings.HasSuffix(rel, "/archtest") {
				return nil
			}
			files, err := os.ReadDir(path)
			if err != nil {
				return err
			}
			production, tests := 0, 0
			for _, file := range files {
				switch {
				case strings.HasSuffix(file.Name(), "_test.go"):
					tests++
				case filepath.Ext(file.Name()) == ".go":
					production++
				}
			}
			if _, allowed := untestedPackages[rel]; production > 0 && tests == 0 && !allowed {
				t.Errorf("%s has no tests", rel)
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestTestFilesMirrorSourceFiles(t *testing.T) {
	root := moduleRoot(t)
	err := filepath.WalkDir(filepath.Join(root, "internal"), func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if entry.Name() == "testdata" || entry.Name() == "archtest" || strings.HasSuffix(filepath.ToSlash(path), "internal/adapter/postgres/ent") {
				return filepath.SkipDir
			}
			return nil
		}
		name := entry.Name()
		if !strings.HasSuffix(name, "_test.go") || name == "fixture_test.go" {
			return nil
		}
		source := strings.TrimSuffix(strings.TrimSuffix(name, "_test.go"), "_internal") + ".go"
		if _, err := os.Stat(filepath.Join(filepath.Dir(path), source)); err != nil {
			rel, _ := filepath.Rel(root, path)
			t.Errorf("%s does not mirror a source file (expected %s); shared setup goes in fixture_test.go", filepath.ToSlash(rel), source)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
