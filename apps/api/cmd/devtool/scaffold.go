package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"go/format"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"text/template"
)

var capabilityName = regexp.MustCompile(`^[a-z][a-z0-9]{1,30}$`)

type scaffold struct {
	Name   string
	Title  string
	Upper  string
	Table  string
	Range  int
	Module string
}

var scaffoldFiles = map[string]string{
	"internal/{{.Name}}/{{.Name}}.go": `package {{.Name}}

import "time"

type {{.Title}} struct {
	ID      int
	Created time.Time
	Updated time.Time
}
`,
	"internal/{{.Name}}/errors.go": `package {{.Name}}

import "{{.Module}}/internal/apperror"

var ErrNotFound = apperror.Define({{.Range}}101, "{{.Upper}}_NOT_FOUND", apperror.KindNotFound)
`,
	"internal/{{.Name}}/ports.go": `package {{.Name}}

import "context"

type Repository interface {
	Get(ctx context.Context, id int) ({{.Title}}, error)
}
`,
	"internal/{{.Name}}/service.go": `package {{.Name}}

import "context"

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context, id int) ({{.Title}}, error) {
	return s.repo.Get(ctx, id)
}
`,
	"internal/{{.Name}}/service_test.go": `package {{.Name}}_test

import (
	"errors"
	"testing"

	"{{.Module}}/internal/{{.Name}}"
	"{{.Module}}/internal/{{.Name}}/{{.Name}}test"
)

func TestGetReturnsStored{{.Title}}(t *testing.T) {
	repo := {{.Name}}test.NewMemoryRepository()
	stored := repo.Add({{.Name}}.{{.Title}}{})
	got, err := {{.Name}}.NewService(repo).Get(t.Context(), stored.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ID != stored.ID {
		t.Fatalf("got %d, want %d", got.ID, stored.ID)
	}
}

func TestGetReportsMissing{{.Title}}(t *testing.T) {
	_, err := {{.Name}}.NewService({{.Name}}test.NewMemoryRepository()).Get(t.Context(), 1)
	if !errors.Is(err, {{.Name}}.ErrNotFound) {
		t.Fatalf("get: %v", err)
	}
}
`,
	"internal/{{.Name}}/{{.Name}}test/memory.go": `package {{.Name}}test

import (
	"context"
	"sync"

	"{{.Module}}/internal/{{.Name}}"
)

type MemoryRepository struct {
	mu     sync.Mutex
	nextID int
	items  map[int]{{.Name}}.{{.Title}}
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{items: map[int]{{.Name}}.{{.Title}}{}}
}

func (r *MemoryRepository) Add(item {{.Name}}.{{.Title}}) {{.Name}}.{{.Title}} {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.nextID++
	item.ID = r.nextID
	r.items[item.ID] = item
	return item
}

func (r *MemoryRepository) Get(_ context.Context, id int) ({{.Name}}.{{.Title}}, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.items[id]
	if !ok {
		return {{.Name}}.{{.Title}}{}, {{.Name}}.ErrNotFound
	}
	return item, nil
}
`,
	"internal/{{.Name}}/{{.Name}}test/contract.go": `package {{.Name}}test

import (
	"errors"
	"testing"

	"{{.Module}}/internal/{{.Name}}"
)

type Env struct {
	Repo {{.Name}}.Repository
}

func RepositoryContract(t *testing.T, newEnv func(t *testing.T) Env) {
	t.Run("missing rows are reported with domain errors", func(t *testing.T) {
		env := newEnv(t)
		if _, err := env.Repo.Get(t.Context(), 987654); !errors.Is(err, {{.Name}}.ErrNotFound) {
			t.Fatalf("get: %v", err)
		}
	})
}
`,
	"internal/{{.Name}}/{{.Name}}test/memory_test.go": `package {{.Name}}test

import "testing"

func TestMemoryRepositoryContract(t *testing.T) {
	RepositoryContract(t, func(*testing.T) Env {
		return Env{Repo: NewMemoryRepository()}
	})
}
`,
	"internal/adapter/postgres/ent/schema/{{.Name}}.go": `package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
)

type {{.Title}} struct {
	ent.Schema
}

func ({{.Title}}) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("{{.Table}}")}
}

func ({{.Title}}) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		created(),
		updated(),
	}
}
`,
	"internal/adapter/postgres/{{.Name}}pg/repository.go": `package {{.Name}}pg

import (
	"context"
	"fmt"

	"{{.Module}}/internal/adapter/postgres"
	"{{.Module}}/internal/adapter/postgres/ent"
	"{{.Module}}/internal/{{.Name}}"
)

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Get(ctx context.Context, id int) ({{.Name}}.{{.Title}}, error) {
	row, err := r.db(ctx).{{.Title}}.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return {{.Name}}.{{.Title}}{}, {{.Name}}.ErrNotFound
	}
	if err != nil {
		return {{.Name}}.{{.Title}}{}, fmt.Errorf("get {{.Name}} %d: %w", id, err)
	}
	return to{{.Title}}(row), nil
}
`,
	"internal/adapter/postgres/{{.Name}}pg/mapping.go": `package {{.Name}}pg

import (
	"{{.Module}}/internal/adapter/postgres/ent"
	"{{.Module}}/internal/{{.Name}}"
)

func to{{.Title}}(row *ent.{{.Title}}) {{.Name}}.{{.Title}} {
	return {{.Name}}.{{.Title}}{
		ID:      row.ID,
		Created: row.Created,
		Updated: row.Updated,
	}
}
`,
	"internal/adapter/postgres/{{.Name}}pg/repository_test.go": `package {{.Name}}pg_test

import (
	"testing"

	"{{.Module}}/internal/adapter/postgres/{{.Name}}pg"
	"{{.Module}}/internal/adapter/postgres/pgtest"
	"{{.Module}}/internal/{{.Name}}/{{.Name}}test"
)

func TestRepositoryContract(t *testing.T) {
	{{.Name}}test.RepositoryContract(t, func(t *testing.T) {{.Name}}test.Env {
		return {{.Name}}test.Env{Repo: {{.Name}}pg.NewRepository(pgtest.New(t).Ent)}
	})
}
`,
	"internal/transport/http/{{.Name}}http/handler.go": `package {{.Name}}http

import (
	"context"
	"net/http"

	"{{.Module}}/internal/{{.Name}}"
	"{{.Module}}/internal/transport/http/httpapi"
	"{{.Module}}/internal/transport/http/response"
)

var tags = []string{"{{.Name}}"}

type Handler struct {
	service *{{.Name}}.Service
	resp    *response.Builder
}

func NewHandler(service *{{.Name}}.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "{{.Name}}.get", Method: http.MethodGet, Path: "/{{.Table}}/{id}", Summary: "Get a {{.Name}}", Tags: tags}, h.get)
}

func (h *Handler) get(ctx context.Context, in *{{.Name}}PathInput) (*response.Output[{{.Name}}DTO], error) {
	item, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, to{{.Title}}DTO(item)), nil
}
`,
	"internal/transport/http/{{.Name}}http/request.go": `package {{.Name}}http

type {{.Name}}PathInput struct {
	ID int ` + "`" + `path:"id" minimum:"1"` + "`" + `
}
`,
	"internal/transport/http/{{.Name}}http/response.go": `package {{.Name}}http

import (
	"time"

	"{{.Module}}/internal/{{.Name}}"
)

type {{.Name}}DTO struct {
	ID      int       ` + "`" + `json:"id"` + "`" + `
	Created time.Time ` + "`" + `json:"created"` + "`" + `
	Updated time.Time ` + "`" + `json:"updated"` + "`" + `
}

func to{{.Title}}DTO(item {{.Name}}.{{.Title}}) {{.Name}}DTO {
	return {{.Name}}DTO{ID: item.ID, Created: item.Created, Updated: item.Updated}
}
`,
}

func createFeature(ctx context.Context, root, name, rawRange string) error {
	if !capabilityName.MatchString(name) {
		return fmt.Errorf("capability name %q must be lower case letters and digits", name)
	}
	prefix, err := strconv.Atoi(rawRange)
	if err != nil || prefix < 100 || prefix > 999 {
		return fmt.Errorf("range %q must be a three digit prefix", rawRange)
	}
	data := scaffold{
		Name:   name,
		Title:  strings.ToUpper(name[:1]) + name[1:],
		Upper:  strings.ToUpper(name),
		Table:  name + "s",
		Range:  prefix,
		Module: "github.com/Ringyuki/shionlib/apps/api",
	}
	files, err := renderFeature(root, data)
	if err != nil {
		return err
	}
	for path, content := range files {
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			return err
		}
		if err := os.WriteFile(path, content, 0o600); err != nil {
			return err
		}
	}
	if err := registerRange(root, data); err != nil {
		return err
	}
	if err := generateEnt(ctx, root); err != nil {
		return err
	}
	fmt.Printf("created %s; next: go run ./cmd/devtool migrate diff create_%s, then add a wire function for %spg, %s.Service and %shttp in internal/bootstrap and list it in wirings\n", name, data.Table, name, name, name)
	return nil
}

func renderFeature(root string, data scaffold) (map[string][]byte, error) {
	files := make(map[string][]byte, len(scaffoldFiles))
	for pathTemplate, body := range scaffoldFiles {
		path, err := render(pathTemplate, data)
		if err != nil {
			return nil, err
		}
		full := filepath.Join(root, path)
		if _, err := os.Stat(full); err == nil {
			return nil, fmt.Errorf("%s already exists", path)
		}
		if _, err := os.Stat(filepath.Dir(full)); err == nil && !strings.HasSuffix(filepath.Dir(path), "schema") {
			return nil, fmt.Errorf("%s already exists", filepath.Dir(path))
		}
		content, err := render(body, data)
		if err != nil {
			return nil, err
		}
		formatted, err := format.Source([]byte(content))
		if err != nil {
			return nil, fmt.Errorf("format %s: %w", path, err)
		}
		files[full] = formatted
	}
	return files, nil
}

func generateEnt(ctx context.Context, root string) error {
	cmd := exec.CommandContext(ctx, "go", "run", "./cmd/entgen")
	cmd.Dir = root
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("generate ent: %w", err)
	}
	return nil
}

func registerRange(root string, data scaffold) error {
	path := filepath.Join(root, "internal", "apperror", "ranges.go")
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	source := string(raw)
	if strings.Contains(source, fmt.Sprintf("Prefix: %d,", data.Range)) {
		return fmt.Errorf("range %d is already registered", data.Range)
	}
	start := strings.Index(source, "var Ranges = []Range{")
	if start < 0 {
		return errors.New("could not find apperror.Ranges")
	}
	end := strings.Index(source[start:], "\n}\n")
	if end < 0 {
		return errors.New("could not find the end of apperror.Ranges")
	}
	end += start
	entry := fmt.Sprintf("\n\t{Prefix: %d, Owner: \"internal/%s\", Domain: %q},", data.Range, data.Name, data.Name)
	source = source[:end] + entry + source[end:]
	formatted, err := format.Source([]byte(source))
	if err != nil {
		return err
	}
	return os.WriteFile(path, formatted, 0o600)
}

func render(text string, data scaffold) (string, error) {
	tmpl, err := template.New("scaffold").Parse(text)
	if err != nil {
		return "", err
	}
	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", err
	}
	return out.String(), nil
}
