package archtest

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var backgroundContextAllowed = map[string]string{
	"internal/transport/http/errmap/mapper.go": "huma.NewError has no context; NewErrorWithContext covers request paths",
}

func walkProductionFiles(t *testing.T, visit func(rel string, file *ast.File)) {
	t.Helper()
	root := moduleRoot(t)
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			name := entry.Name()
			if path != root && (strings.HasPrefix(name, ".") || name == "testdata") || strings.HasSuffix(filepath.ToSlash(path), "internal/adapter/postgres/ent") {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		if strings.HasPrefix(rel, "cmd/") || isTestSupport(rel) {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.SkipObjectResolution)
		if err != nil {
			return err
		}
		visit(rel, file)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func isTestSupport(rel string) bool {
	dir := filepath.Base(filepath.Dir(rel))
	return strings.HasSuffix(dir, "test") && dir != "archtest"
}

func TestGoroutinesHaveOwners(t *testing.T) {
	walkProductionFiles(t, func(rel string, file *ast.File) {
		if strings.HasPrefix(rel, "internal/platform/") {
			return
		}
		ast.Inspect(file, func(node ast.Node) bool {
			if _, ok := node.(*ast.GoStmt); ok {
				t.Errorf("%s starts a goroutine; long-running work belongs to a runtime.Runner in internal/platform or a River job", rel)
			}
			return true
		})
	})
}

func TestRequestPathsKeepTheirContext(t *testing.T) {
	walkProductionFiles(t, func(rel string, file *ast.File) {
		if _, ok := backgroundContextAllowed[rel]; ok || strings.HasPrefix(rel, "internal/bootstrap/") {
			return
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			if pkg, ok := selector.X.(*ast.Ident); ok && pkg.Name == "context" && (selector.Sel.Name == "Background" || selector.Sel.Name == "TODO") {
				t.Errorf("%s calls context.%s; propagate the caller's context (use context.WithoutCancel for detached work)", rel, selector.Sel.Name)
			}
			return true
		})
	})
}

func TestLoggersComeFromThePlatform(t *testing.T) {
	walkProductionFiles(t, func(rel string, file *ast.File) {
		if strings.HasPrefix(rel, "internal/platform/logger/") {
			return
		}
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}
			if pkg, ok := selector.X.(*ast.Ident); ok && pkg.Name == "slog" && (selector.Sel.Name == "New" || strings.HasSuffix(selector.Sel.Name, "Handler")) {
				t.Errorf("%s calls slog.%s; inject the *slog.Logger built by internal/platform/logger", rel, selector.Sel.Name)
			}
			return true
		})
	})
}
