package archtest

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"golang.org/x/tools/go/packages"
)

const module = "github.com/Ringyuki/shionlib/apps/api"

type layer string

const (
	layerKernel    layer = "kernel"
	layerBusiness  layer = "business"
	layerPlatform  layer = "platform"
	layerAdapter   layer = "adapter"
	layerTransport layer = "transport"
	layerBootstrap layer = "bootstrap"
	layerCommand   layer = "cmd"
	layerTooling   layer = "tooling"
	layerGenerated layer = "generated"
)

var kernelPackages = []string{
	module + "/internal/apperror",
	module + "/internal/actor",
}

var allowedImports = map[layer][]layer{
	layerKernel:    {layerKernel},
	layerBusiness:  {layerKernel, layerBusiness},
	layerPlatform:  {layerKernel, layerPlatform, layerGenerated},
	layerAdapter:   {layerKernel, layerBusiness, layerPlatform, layerAdapter, layerGenerated},
	layerTransport: {layerKernel, layerBusiness, layerPlatform, layerTransport},
	layerBootstrap: {layerKernel, layerBusiness, layerPlatform, layerAdapter, layerTransport, layerGenerated},
	layerCommand:   {layerKernel, layerBusiness, layerPlatform, layerAdapter, layerTransport, layerBootstrap, layerGenerated},
	layerTooling:   {layerKernel, layerBusiness, layerPlatform, layerAdapter, layerTransport, layerBootstrap, layerGenerated},
	layerGenerated: {layerKernel, layerPlatform, layerAdapter, layerGenerated},
}

var businessExternalAllow = []string{
	"golang.org/x/sync",
	"golang.org/x/text",
	"github.com/google/uuid",
}

var businessStdlibDeny = []string{
	"net/http",
	"database/sql",
	"os/exec",
	"syscall",
	"unsafe",
}

var forbiddenPackageNames = []string{"util", "utils", "common", "helper", "helpers", "base", "misc", "shared", "core", "models", "interfaces", "types"}

func classify(path string) layer {
	switch {
	case slices.Contains(kernelPackages, path):
		return layerKernel
	case strings.HasPrefix(path, module+"/internal/adapter/postgres/ent"), path == module+"/migrations":
		return layerGenerated
	case strings.HasPrefix(path, module+"/internal/platform"):
		return layerPlatform
	case strings.HasPrefix(path, module+"/internal/adapter"):
		return layerAdapter
	case strings.HasPrefix(path, module+"/internal/transport"):
		return layerTransport
	case strings.HasPrefix(path, module+"/internal/bootstrap"):
		return layerBootstrap
	case strings.HasPrefix(path, module+"/internal/archtest"), strings.HasPrefix(path, module+"/cmd/devtool"), strings.HasPrefix(path, module+"/cmd/entgen"):
		return layerTooling
	case strings.HasPrefix(path, module+"/cmd"):
		return layerCommand
	case strings.HasPrefix(path, module+"/internal/"):
		return layerBusiness
	default:
		return layerTooling
	}
}

func loadPackages(t *testing.T) []*packages.Package {
	t.Helper()
	config := &packages.Config{
		Mode:  packages.NeedName | packages.NeedImports | packages.NeedFiles,
		Dir:   moduleRoot(t),
		Tests: false,
	}
	pkgs, err := packages.Load(config, "./...")
	if err != nil {
		t.Fatalf("load packages: %v", err)
	}
	if packages.PrintErrors(pkgs) > 0 {
		t.Fatal("packages failed to load")
	}
	return pkgs
}

func moduleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}

func TestLayerDependencies(t *testing.T) {
	for _, pkg := range loadPackages(t) {
		from := classify(pkg.PkgPath)
		for imported := range pkg.Imports {
			if !strings.HasPrefix(imported, module+"/") {
				continue
			}
			to := classify(imported)
			if !slices.Contains(allowedImports[from], to) {
				t.Errorf("%s (%s) must not import %s (%s)", pkg.PkgPath, from, imported, to)
			}
		}
	}
}

func TestBusinessExternalDependencies(t *testing.T) {
	for _, pkg := range loadPackages(t) {
		if classify(pkg.PkgPath) != layerBusiness && classify(pkg.PkgPath) != layerKernel {
			continue
		}
		for imported := range pkg.Imports {
			if strings.HasPrefix(imported, module+"/") {
				continue
			}
			if isStdlib(imported) {
				if slices.Contains(businessStdlibDeny, imported) {
					t.Errorf("%s must not import %s", pkg.PkgPath, imported)
				}
				continue
			}
			if !slices.ContainsFunc(businessExternalAllow, func(prefix string) bool { return imported == prefix || strings.HasPrefix(imported, prefix+"/") }) {
				t.Errorf("%s imports third-party %s; business packages depend on ports implemented in internal/adapter", pkg.PkgPath, imported)
			}
		}
	}
}

func TestPackageNames(t *testing.T) {
	for _, pkg := range loadPackages(t) {
		if slices.Contains(forbiddenPackageNames, pkg.Name) {
			t.Errorf("package %s uses the catch-all name %q", pkg.PkgPath, pkg.Name)
		}
	}
}

func TestNoComments(t *testing.T) {
	root := moduleRoot(t)
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if path != root && (strings.HasPrefix(entry.Name(), ".") || entry.Name() == "testdata") {
				return filepath.SkipDir
			}
			if strings.HasSuffix(filepath.ToSlash(path), "internal/adapter/postgres/ent") {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ParseComments)
		if err != nil {
			return err
		}
		if ast.IsGenerated(file) {
			return nil
		}
		for _, group := range file.Comments {
			for _, comment := range group.List {
				if strings.HasPrefix(comment.Text, "//go:") {
					continue
				}
				rel, _ := filepath.Rel(root, path)
				t.Errorf("%s contains a comment %q; the codebase is comment-free, encode intent in names and tests", rel, comment.Text)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func isStdlib(path string) bool {
	first, _, _ := strings.Cut(path, "/")
	return !strings.Contains(first, ".")
}
