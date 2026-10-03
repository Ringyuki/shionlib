package archtest

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"testing"
	"unicode"
)

var libraryPackages = []string{"apperror", "actor", "lexical", "paging", "patch", "txtest"}

var transportInfrastructure = []string{"httpapi", "middleware", "response", "errmap", "reqstate", "clientinfo", "apitest", "lexicalhttp"}

var bannedTypeSuffixes = []string{"Manager", "Processor", "Usecase", "UseCase", "Interactor", "Coordinator", "Facade", "Helper", "Util", "Utils", "Impl", "Controller"}

var (
	serviceFile   = regexp.MustCompile(`^service(_[a-z0-9_]+)?\.go$`)
	handlerFile   = regexp.MustCompile(`^handler(_[a-z0-9_]+)?\.go$`)
	requestFile   = regexp.MustCompile(`^request(_[a-z0-9_]+)?\.go$`)
	responseFile  = regexp.MustCompile(`^response(_[a-z0-9_]+)?\.go$`)
	workerFile    = regexp.MustCompile(`^worker(_[a-z0-9_]+)?\.go$`)
	repoFile      = regexp.MustCompile(`^(repository|store)(_[a-z0-9_]+)?\.go$`)
	camelBoundary = regexp.MustCompile(`([a-z0-9])([A-Z])`)
)

type sourceFile struct {
	name string
	ast  *ast.File
}

type sourcePackage struct {
	dir   string
	name  string
	files []sourceFile
}

func loadSources(t *testing.T, root string) []sourcePackage {
	t.Helper()
	byDir := map[string]*sourcePackage{}
	err := filepath.WalkDir(filepath.Join(root, "internal"), func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if strings.HasSuffix(filepath.ToSlash(path), "internal/adapter/postgres/ent") || entry.Name() == "testdata" {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.SkipObjectResolution)
		if err != nil {
			return err
		}
		dir := filepath.Dir(path)
		pkg := byDir[dir]
		if pkg == nil {
			rel, _ := filepath.Rel(root, dir)
			pkg = &sourcePackage{dir: filepath.ToSlash(rel), name: file.Name.Name}
			byDir[dir] = pkg
		}
		pkg.files = append(pkg.files, sourceFile{name: filepath.Base(path), ast: file})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	out := make([]sourcePackage, 0, len(byDir))
	for _, pkg := range byDir {
		sort.Slice(pkg.files, func(i, j int) bool { return pkg.files[i].name < pkg.files[j].name })
		out = append(out, *pkg)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].dir < out[j].dir })
	return out
}

func isCapability(pkg sourcePackage) bool {
	parts := strings.Split(pkg.dir, "/")
	return len(parts) == 2 && parts[0] == "internal" && classify(module+"/"+pkg.dir) == layerBusiness && !slices.Contains(libraryPackages, pkg.name)
}

func isTransportHTTP(pkg sourcePackage) bool {
	return strings.HasPrefix(pkg.dir, "internal/transport/http/") && !slices.Contains(transportInfrastructure, pkg.name)
}

func isTransportJobs(pkg sourcePackage) bool {
	return strings.HasPrefix(pkg.dir, "internal/transport/jobs/")
}

func isPostgresAdapter(pkg sourcePackage) bool {
	return strings.HasPrefix(pkg.dir, "internal/adapter/postgres/") && strings.HasSuffix(pkg.name, "pg")
}

func snake(name string) string {
	return strings.ToLower(camelBoundary.ReplaceAllString(name, "${1}_${2}"))
}

func isModelFile(pkg sourcePackage, file string) bool {
	return file == pkg.name+".go" || (strings.HasPrefix(file, pkg.name+"_") && strings.HasSuffix(file, ".go"))
}

func expectedServiceFile(typeName string) string {
	if typeName == "Service" {
		return "service.go"
	}
	return "service_" + snake(strings.TrimSuffix(typeName, "Service")) + ".go"
}

type finding struct {
	where string
	what  string
}

func (f finding) String() string {
	return f.where + ": " + f.what
}

func receiverName(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) == 0 {
		return ""
	}
	expr := fn.Recv.List[0].Type
	if star, ok := expr.(*ast.StarExpr); ok {
		expr = star.X
	}
	if index, ok := expr.(*ast.IndexExpr); ok {
		expr = index.X
	}
	if ident, ok := expr.(*ast.Ident); ok {
		return ident.Name
	}
	return ""
}

func isErrorDefinition(value ast.Expr) bool {
	call, ok := value.(*ast.CallExpr)
	if !ok {
		return false
	}
	selector, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, ok := selector.X.(*ast.Ident)
	if !ok {
		return false
	}
	return (pkg.Name == "apperror" && selector.Sel.Name == "Define") || (pkg.Name == "errors" && selector.Sel.Name == "New")
}

func injectsPorts(spec *ast.TypeSpec, interfaces map[string]bool) bool {
	structure, ok := spec.Type.(*ast.StructType)
	if !ok {
		return false
	}
	for _, field := range structure.Fields.List {
		if ident, ok := field.Type.(*ast.Ident); ok && interfaces[ident.Name] {
			return true
		}
	}
	return false
}

func checkCapability(pkg sourcePackage) []finding {
	var out []finding
	names := map[string]bool{}
	interfaces := map[string]bool{}
	for _, file := range pkg.files {
		names[file.name] = true
		for _, decl := range file.ast.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				if typeSpec := spec.(*ast.TypeSpec); isInterface(typeSpec) {
					interfaces[typeSpec.Name.Name] = true
				}
			}
		}
	}
	if !names[pkg.name+".go"] {
		out = append(out, finding{pkg.dir, fmt.Sprintf("missing %s.go holding the capability's model", pkg.name)})
	}
	for _, file := range pkg.files {
		if file.name != pkg.name+".go" {
			continue
		}
		declaresType := false
		for _, decl := range file.ast.Decls {
			if gen, ok := decl.(*ast.GenDecl); ok && gen.Tok == token.TYPE {
				declaresType = true
			}
		}
		if !declaresType {
			out = append(out, finding{pkg.dir + "/" + file.name, "the capability's core model types belong in this file"})
		}
	}
	serviceTypes := map[string]string{}
	for _, file := range pkg.files {
		for _, decl := range file.ast.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				typeSpec := spec.(*ast.TypeSpec)
				name := typeSpec.Name.Name
				if name == "Service" || strings.HasSuffix(name, "Service") {
					serviceTypes[name] = expectedServiceFile(name)
				} else if injectsPorts(typeSpec, interfaces) && unicode.IsUpper(rune(name[0])) && !strings.HasSuffix(name, "Deps") && !strings.HasSuffix(name, "Options") {
					out = append(out, finding{pkg.dir + "/" + file.name, fmt.Sprintf("%s is built from injected ports, so it is a service: name it Service or <Purpose>Service", name)})
				}
			}
		}
	}
	for _, file := range pkg.files {
		allowed := isModelFile(pkg, file.name) || file.name == "errors.go" || file.name == "ports.go" || file.name == "jobs.go" || serviceFile.MatchString(file.name)
		if !allowed {
			out = append(out, finding{pkg.dir + "/" + file.name, fmt.Sprintf("file name must be %s.go, %s_<concept>.go, ports.go, errors.go, jobs.go or service[_<purpose>].go", pkg.name, pkg.name)})
		}
		for _, decl := range file.ast.Decls {
			switch d := decl.(type) {
			case *ast.GenDecl:
				out = append(out, checkCapabilityGenDecl(pkg, file, d, serviceTypes)...)
			case *ast.FuncDecl:
				owner := receiverName(d)
				if owner == "" && strings.HasPrefix(d.Name.Name, "New") {
					owner = strings.TrimPrefix(d.Name.Name, "New")
				}
				if want, ok := serviceTypes[owner]; ok && file.name != want {
					out = append(out, finding{pkg.dir + "/" + file.name, fmt.Sprintf("%s belongs to %s and must live in %s", d.Name.Name, owner, want)})
				}
				if owner == "" && d.Name.IsExported() && serviceFile.MatchString(file.name) {
					out = append(out, finding{pkg.dir + "/" + file.name, fmt.Sprintf("exported function %s is model logic and must live in a model file", d.Name.Name)})
				}
			}
		}
	}
	return out
}

func isInterface(spec *ast.TypeSpec) bool {
	_, ok := spec.Type.(*ast.InterfaceType)
	return ok
}

func hasKindMethod(pkg sourcePackage, typeName string) bool {
	for _, file := range pkg.files {
		for _, decl := range file.ast.Decls {
			if fn, ok := decl.(*ast.FuncDecl); ok && fn.Name.Name == "Kind" && receiverName(fn) == typeName {
				return true
			}
		}
	}
	return false
}

func checkCapabilityGenDecl(pkg sourcePackage, file sourceFile, decl *ast.GenDecl, serviceTypes map[string]string) []finding {
	var out []finding
	where := pkg.dir + "/" + file.name
	for _, spec := range decl.Specs {
		switch s := spec.(type) {
		case *ast.TypeSpec:
			name := s.Name.Name
			if isInterface(s) {
				if file.name != "ports.go" {
					out = append(out, finding{where, fmt.Sprintf("interface %s must be declared in ports.go", name)})
				}
				continue
			}
			for _, suffix := range bannedTypeSuffixes {
				if strings.HasSuffix(name, suffix) {
					out = append(out, finding{where, fmt.Sprintf("%s uses the banned suffix %q; see docs/glossary.md", name, suffix)})
				}
			}
			if want, ok := serviceTypes[name]; ok {
				if file.name != want {
					out = append(out, finding{where, fmt.Sprintf("%s must live in %s", name, want)})
				}
				continue
			}
			if owner := strings.TrimSuffix(strings.TrimSuffix(name, "Deps"), "Options"); owner != name {
				if want, ok := serviceTypes[owner]; ok && file.name != want {
					out = append(out, finding{where, fmt.Sprintf("%s configures %s and must live in %s", name, owner, want)})
				}
				if _, ok := serviceTypes[owner+"Service"]; ok && file.name != serviceTypes[owner+"Service"] {
					out = append(out, finding{where, fmt.Sprintf("%s configures %sService and must live in %s", name, owner, serviceTypes[owner+"Service"])})
				}
				if owner == "" && file.name != "service.go" {
					out = append(out, finding{where, fmt.Sprintf("%s configures Service and must live in service.go", name)})
				}
				continue
			}
			if hasKindMethod(pkg, name) {
				if file.name != "jobs.go" {
					out = append(out, finding{where, fmt.Sprintf("job %s must be declared in jobs.go", name)})
				}
				continue
			}
			if (s.Name.IsExported() || serviceFile.MatchString(file.name)) && !isModelFile(pkg, file.name) {
				out = append(out, finding{where, fmt.Sprintf("model type %s must live in %s.go or %s_<concept>.go", name, pkg.name, pkg.name)})
			}
		case *ast.ValueSpec:
			if serviceFile.MatchString(file.name) {
				for _, name := range s.Names {
					out = append(out, finding{where, fmt.Sprintf("%s %s belongs in a model file; service files hold only the service, its Deps/Options, constructor and methods", decl.Tok, name.Name)})
				}
			}
			for i, value := range s.Values {
				if isErrorDefinition(value) && file.name != "errors.go" {
					out = append(out, finding{where, fmt.Sprintf("error %s must be defined in errors.go", s.Names[i].Name)})
				}
			}
			if decl.Tok == token.CONST && file.name == "errors.go" {
				out = append(out, finding{where, "errors.go holds only error definitions"})
			}
		}
	}
	return out
}

func checkTransportHTTP(pkg sourcePackage) []finding {
	var out []finding
	for _, file := range pkg.files {
		where := pkg.dir + "/" + file.name
		if !handlerFile.MatchString(file.name) && !requestFile.MatchString(file.name) && !responseFile.MatchString(file.name) {
			out = append(out, finding{where, "HTTP packages contain only handler[_<purpose>].go, request[_<purpose>].go and response[_<purpose>].go"})
			continue
		}
		for _, decl := range file.ast.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				typeSpec := spec.(*ast.TypeSpec)
				name := typeSpec.Name.Name
				if responseFile.MatchString(file.name) && hasUntypedValues(typeSpec.Type) {
					out = append(out, finding{where, fmt.Sprintf("%s exposes any/map[string]any; response shapes are typed DTOs (use a sealed <Purpose>DTO interface for unions)", name)})
				}
				switch {
				case strings.HasSuffix(name, "DTO"):
					if !responseFile.MatchString(file.name) {
						out = append(out, finding{where, fmt.Sprintf("response type %s must live in response[_<purpose>].go", name)})
					}
				case isInterface(typeSpec) || strings.HasSuffix(name, "Deps") || strings.HasSuffix(name, "Options"):
					if !handlerFile.MatchString(file.name) {
						out = append(out, finding{where, fmt.Sprintf("handler dependency %s must live in handler[_<purpose>].go", name)})
					}
				case name == "Handler" || strings.HasSuffix(name, "Handler"):
					if !handlerFile.MatchString(file.name) {
						out = append(out, finding{where, fmt.Sprintf("%s must live in handler[_<purpose>].go", name)})
					}
				case strings.HasSuffix(name, "Input"):
					if !requestFile.MatchString(file.name) {
						out = append(out, finding{where, fmt.Sprintf("request type %s must live in request[_<purpose>].go", name)})
					}
				default:
					out = append(out, finding{where, fmt.Sprintf("%s must be a <Purpose>Handler, its <Purpose>Deps/<Purpose>Options or port, a request type named <Purpose>Input or a response type named <Purpose>DTO", name)})
				}
			}
		}
	}
	return out
}

func hasUntypedValues(expr ast.Expr) bool {
	untyped := false
	ast.Inspect(expr, func(node ast.Node) bool {
		switch n := node.(type) {
		case *ast.Ident:
			if n.Name == "any" {
				untyped = true
			}
		case *ast.InterfaceType:
			if n.Methods == nil || len(n.Methods.List) == 0 {
				untyped = true
			}
		}
		return !untyped
	})
	return untyped
}

func checkTransportJobs(pkg sourcePackage) []finding {
	var out []finding
	constructors := map[string]bool{}
	workers := map[string]string{}
	for _, file := range pkg.files {
		where := pkg.dir + "/" + file.name
		if !workerFile.MatchString(file.name) && file.name != "tasks.go" {
			out = append(out, finding{where, "job packages contain only worker[_<purpose>].go and tasks.go"})
			continue
		}
		for _, decl := range file.ast.Decls {
			if fn, ok := decl.(*ast.FuncDecl); ok && fn.Recv == nil {
				constructors[fn.Name.Name] = true
				if (fn.Name.Name == "Tasks" || fn.Name.Name == "Register") && file.name != "tasks.go" {
					out = append(out, finding{where, fn.Name.Name + " must live in tasks.go"})
				}
			}
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				name := spec.(*ast.TypeSpec).Name.Name
				if strings.HasSuffix(strings.ToLower(name), "worker") && !strings.HasSuffix(name, "Worker") {
					out = append(out, finding{where, fmt.Sprintf("%s must end with Worker", name)})
				}
				if strings.HasSuffix(name, "Worker") && !workerFile.MatchString(file.name) {
					out = append(out, finding{where, fmt.Sprintf("%s must live in worker[_<purpose>].go", name)})
				}
				if strings.HasSuffix(name, "Worker") {
					workers[name] = where
				}
			}
		}
	}
	for name, where := range workers {
		if !ast.IsExported(name) {
			out = append(out, finding{where, fmt.Sprintf("%s must be exported", name)})
		}
		if !constructors["New"+name] {
			out = append(out, finding{where, fmt.Sprintf("%s needs a New%s constructor", name, name)})
		}
	}
	return out
}

func checkPostgresAdapter(pkg sourcePackage) []finding {
	var out []finding
	for _, file := range pkg.files {
		where := pkg.dir + "/" + file.name
		if !repoFile.MatchString(file.name) && file.name != "mapping.go" {
			out = append(out, finding{where, "Postgres adapters contain only repository[_<aggregate>].go, store[_<aggregate>].go and mapping.go"})
		}
		for _, decl := range file.ast.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				typeSpec := spec.(*ast.TypeSpec)
				name := typeSpec.Name.Name
				if !typeSpec.Name.IsExported() {
					continue
				}
				if !strings.HasSuffix(name, "Repository") && !strings.HasSuffix(name, "Store") {
					out = append(out, finding{where, fmt.Sprintf("exported adapter type %s must be named <Purpose>Repository or <Purpose>Store", name)})
				}
			}
		}
	}
	return out
}

func checkBannedNames(pkg sourcePackage) []finding {
	var out []finding
	for _, file := range pkg.files {
		for _, decl := range file.ast.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.TYPE {
				continue
			}
			for _, spec := range gen.Specs {
				name := spec.(*ast.TypeSpec).Name.Name
				for _, suffix := range bannedTypeSuffixes {
					if strings.HasSuffix(name, suffix) {
						out = append(out, finding{pkg.dir + "/" + file.name, fmt.Sprintf("%s uses the banned suffix %q; see docs/glossary.md", name, suffix)})
					}
				}
			}
		}
	}
	return out
}

func TestPackageStructure(t *testing.T) {
	var findings []finding
	for _, pkg := range loadSources(t, moduleRoot(t)) {
		switch {
		case strings.HasSuffix(pkg.name, "test"):
		case isCapability(pkg):
			findings = append(findings, checkCapability(pkg)...)
		case isTransportHTTP(pkg):
			findings = append(findings, checkTransportHTTP(pkg)...)
			findings = append(findings, checkBannedNames(pkg)...)
		case isTransportJobs(pkg):
			findings = append(findings, checkTransportJobs(pkg)...)
			findings = append(findings, checkBannedNames(pkg)...)
		case isPostgresAdapter(pkg):
			findings = append(findings, checkPostgresAdapter(pkg)...)
			findings = append(findings, checkBannedNames(pkg)...)
		default:
			findings = append(findings, checkBannedNames(pkg)...)
		}
	}
	for _, f := range findings {
		t.Error(f.String())
	}
}
