package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/format"
	"os"
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

type Transactor interface {
	WithinTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}
`,
	"internal/{{.Name}}/service.go": `package {{.Name}}

import "context"

type Service struct {
	repo Repository
	tx   Transactor
}

func NewService(repo Repository, tx Transactor) *Service {
	return &Service{repo: repo, tx: tx}
}

func (s *Service) Get(ctx context.Context, id int) ({{.Title}}, error) {
	return s.repo.Get(ctx, id)
}
`,
	"internal/{{.Name}}/{{.Name}}test/memory.go": `package {{.Name}}test

import (
	"context"
	"sync"

	"{{.Module}}/internal/{{.Name}}"
)

type MemoryRepository struct {
	mu    sync.Mutex
	items map[int]{{.Name}}.{{.Title}}
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{items: map[int]{{.Name}}.{{.Title}}{}}
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
	"context"
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
		if _, err := env.Repo.Get(context.Background(), 987654); !errors.Is(err, {{.Name}}.ErrNotFound) {
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
	"internal/transport/http/{{.Name}}http/handler.go": `package {{.Name}}http

import (
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
	_ = tags
	_ = api
}
`,
}

func createFeature(root, name, rawRange string) error {
	if !capabilityName.MatchString(name) {
		return fmt.Errorf("capability name %q must be lower case letters and digits", name)
	}
	prefix, err := strconv.Atoi(rawRange)
	if err != nil || prefix < 100 || prefix > 999 {
		return fmt.Errorf("range %q must be a three digit prefix", rawRange)
	}
	if _, err := os.Stat(filepath.Join(root, "internal", name)); err == nil {
		return fmt.Errorf("internal/%s already exists", name)
	}
	data := scaffold{
		Name:   name,
		Title:  strings.ToUpper(name[:1]) + name[1:],
		Upper:  strings.ToUpper(name),
		Range:  prefix,
		Module: "github.com/Ringyuki/shionlib/apps/api",
	}
	for pathTemplate, body := range scaffoldFiles {
		path, err := render(pathTemplate, data)
		if err != nil {
			return err
		}
		content, err := render(body, data)
		if err != nil {
			return err
		}
		formatted, err := format.Source([]byte(content))
		if err != nil {
			return fmt.Errorf("format %s: %w", path, err)
		}
		full := filepath.Join(root, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
			return err
		}
		if err := os.WriteFile(full, formatted, 0o600); err != nil {
			return err
		}
	}
	return registerRange(root, data)
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
	anchor := "\n}\n\nfunc PrefixOf"
	if !strings.Contains(source, anchor) {
		return errors.New("could not find the end of apperror.Ranges")
	}
	entry := fmt.Sprintf("\t{Prefix: %d, Owner: \"internal/%s\", Domain: %q},", data.Range, data.Name, data.Name)
	source = strings.Replace(source, anchor, "\n"+entry+anchor, 1)
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
