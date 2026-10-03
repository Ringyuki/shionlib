package bootstrap_test

import (
	"io"
	"log/slog"
	"regexp"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/bootstrap"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
)

func TestOpenAPISchemaNamesAreStable(t *testing.T) {
	cfg, err := config.LoadFrom(map[string]string{
		"DATABASE_URL":         "postgres://offline@localhost:5432/offline",
		"TOKEN_SECRET":         "offline-openapi-secret",
		"REFRESH_TOKEN_PEPPER": "offline",
	})
	if err != nil {
		t.Fatal(err)
	}
	infra, err := bootstrap.OfflineInfra(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = infra.Close(t.Context())
	})
	spec := bootstrap.BuildHTTP(infra, bootstrap.BuildModules(infra)).OpenAPI()
	suffixed := regexp.MustCompile(`[A-Za-z]\d+$`)
	for name := range spec.Components.Schemas.Map() {
		if suffixed.MatchString(name) {
			t.Errorf("schema %s was disambiguated with a numeric suffix; give the Go input/DTO type a capability-specific name", name)
		}
	}
	operationID := regexp.MustCompile(`^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$`)
	seen := map[string]string{}
	for path, item := range spec.Paths {
		for _, op := range []*huma.Operation{item.Get, item.Post, item.Put, item.Patch, item.Delete} {
			if op == nil {
				continue
			}
			if !operationID.MatchString(op.OperationID) {
				t.Errorf("operation %s %s has id %q; use <capability>.<action>", op.Method, path, op.OperationID)
			}
			if previous, ok := seen[op.OperationID]; ok {
				t.Errorf("operation id %s is used by %s and %s", op.OperationID, previous, path)
			}
			seen[op.OperationID] = path
		}
	}
}
