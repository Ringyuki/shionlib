package archtest

import (
	"go/ast"
	"go/token"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
)

const settingsFile = "settings.go"

var settingConstructors = []string{"Int", "Bytes", "Float", "Duration", "Flag", "Text"}

var deploymentKnobs = map[string]string{
	"SHUTDOWN_TIMEOUT":                 "bounds process shutdown before the runtime starts",
	"PORT":                             "listening port",
	"HTTP_EXPOSE_OPENAPI":              "decided per deployment, read when routes are mounted",
	"HTTP_READ_HEADER_TIMEOUT":         "configures the http.Server",
	"HTTP_READ_TIMEOUT":                "configures the http.Server",
	"HTTP_WRITE_TIMEOUT":               "configures the http.Server",
	"HTTP_IDLE_TIMEOUT":                "configures the http.Server",
	"OTEL_TRACES_SAMPLER_ARG":          "configures the tracer provider at startup",
	"DATABASE_MAX_CONNS":               "sizes the connection pool",
	"DATABASE_MIN_CONNS":               "sizes the connection pool",
	"DATABASE_CONN_MAX_LIFETIME":       "configures the connection pool",
	"DATABASE_CONN_MAX_IDLE_TIME":      "configures the connection pool",
	"DATABASE_STATEMENT_TIMEOUT":       "set on every pooled connection",
	"ENABLE_BACKUP":                    "backups depend on the deployment's bucket",
	"DATABASE_BACKUP_RETENTION_DAILY":  "belongs to the backup bucket's lifecycle",
	"DATABASE_BACKUP_RETENTION_WEEKLY": "belongs to the backup bucket's lifecycle",
	"REDIS_PORT":                       "Redis address",
	"REDIS_DB":                         "Redis address",
	"REDIS_TIMEOUT":                    "configures the Redis client",
	"TOKEN_EXPIRES_IN":                 "signed into tokens by the codec built at startup",
	"REFRESH_TOKEN_SHORT_WINDOW":       "security policy fixed with the token secret",
	"REFRESH_TOKEN_LONG_WINDOW":        "security policy fixed with the token secret",
	"REFRESH_TOKEN_ROTATION_GRACE":     "security policy fixed with the token secret",
	"AUTH_COOKIE_SECURE":               "depends on whether the deployment serves HTTPS",
	"WEBAUTHN_TIMEOUT":                 "part of the relying party built at startup",
	"WEBAUTHN_CHALLENGE_TTL":           "part of the relying party built at startup",
	"S3_IMAGE_FORCE_PATH_STYLE":        "depends on the object store vendor",
	"S3_FILE_FORCE_PATH_STYLE":         "depends on the object store vendor",
	"S3_BACKUP_FORCE_PATH_STYLE":       "depends on the object store vendor",
	"FILE_SCAN_ENABLED":                "depends on whether the deployment runs ClamAV",
	"CLAMDSCAN_PORT":                   "ClamAV address",
	"CLAMDSCAN_TIMEOUT":                "configures the ClamAV client",
	"CATALOG_IMPORT_CREATOR_ID":        "names an account of this deployment",
	"CATALOG_IMPORT_WORKERS":           "sizes a River queue at startup",
	"HIKARINAGI_TIMEOUT":               "configures the Hikarinagi HTTP client",
	"HIKARINAGI_REQUESTS_PER_MINUTE":   "rate agreed with the Hikarinagi client credentials",
	"AI_IDLE_TIMEOUT":                  "configures the upstream HTTP clients",
	"AI_MAX_CALL_DURATION":             "configures the upstream HTTP clients",
	"WORKERS_ENABLED":                  "decides which process runs workers",
	"TASKS_IMAGE_UPLOAD_ENABLED":       "decides which process uploads images",
}

func TestTunableValuesLiveInTheSettingCenter(t *testing.T) {
	seen := map[string]bool{}
	walkEnv(reflect.TypeFor[config.Config](), "", func(name string, typ reflect.Type) {
		if !isKnob(typ) {
			return
		}
		seen[name] = true
		if _, ok := deploymentKnobs[name]; !ok {
			t.Errorf("%s is a tunable %s in config.Config; declare a setting.Key in the owning package's settings.go so the admin panel can change it, or list it in deploymentKnobs with the reason it must be fixed at startup", name, typ)
		}
	})
	for name := range deploymentKnobs {
		if !seen[name] {
			t.Errorf("deploymentKnobs lists %s, which config.Config no longer reads", name)
		}
	}
}

func walkEnv(typ reflect.Type, prefix string, visit func(name string, typ reflect.Type)) {
	for field := range typ.Fields() {
		if name, ok := field.Tag.Lookup("env"); ok {
			visit(prefix+name, field.Type)
			continue
		}
		if field.Type.Kind() == reflect.Struct && field.Type != reflect.TypeFor[time.Time]() {
			walkEnv(field.Type, prefix+field.Tag.Get("envPrefix"), visit)
		}
	}
}

func isKnob(typ reflect.Type) bool {
	switch typ.Kind() {
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Float32, reflect.Float64:
		return true
	default:
		return false
	}
}

func TestSettingsAreDeclaredInSettingsFiles(t *testing.T) {
	root := moduleRoot(t)
	for _, pkg := range loadSources(t, root) {
		for _, file := range pkg.files {
			where := filepath.ToSlash(filepath.Join(pkg.dir, file.name))
			if file.name != settingsFile {
				ast.Inspect(file.ast, func(node ast.Node) bool {
					if call, ok := node.(*ast.CallExpr); ok && isSettingDeclaration(call) {
						t.Errorf("%s declares a setting; settings live in the package's %s", where, settingsFile)
					}
					return true
				})
				continue
			}
			for _, decl := range file.ast.Decls {
				gen, ok := decl.(*ast.GenDecl)
				if !ok || (gen.Tok != token.VAR && gen.Tok != token.CONST && gen.Tok != token.IMPORT) {
					t.Errorf("%s holds only setting declarations and the unit constants they use", where)
					continue
				}
				if gen.Tok != token.VAR {
					continue
				}
				for _, spec := range gen.Specs {
					value := spec.(*ast.ValueSpec)
					for i, name := range value.Names {
						if i >= len(value.Values) || !isSettingDeclaration(value.Values[i]) {
							t.Errorf("%s: %s must be a setting declaration (setting.%s)", where, name.Name, strings.Join(settingConstructors, "/"))
						} else if !name.IsExported() {
							t.Errorf("%s: setting %s must be exported so tests and the HTTP layer can read it", where, name.Name)
						}
					}
				}
			}
		}
	}
}

func isSettingDeclaration(expr ast.Expr) bool {
	call, ok := expr.(*ast.CallExpr)
	if !ok {
		return false
	}
	selector, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return false
	}
	pkg, ok := selector.X.(*ast.Ident)
	return ok && pkg.Name == "setting" && slices.Contains(settingConstructors, selector.Sel.Name)
}
