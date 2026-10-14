package httpapi

import (
	"net/http"
	"regexp"
	"slices"
	"sync"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
)

var schemaRef = regexp.MustCompile(`#/components/schemas/([A-Za-z0-9_.-]+)`)

type subsetComponents struct {
	Schemas         map[string]*huma.Schema         `json:"schemas"`
	SecuritySchemes map[string]*huma.SecurityScheme `json:"securitySchemes"`
}

type subsetDocument struct {
	OpenAPI    string                    `json:"openapi"`
	Info       *huma.Info                `json:"info"`
	Servers    []*huma.Server            `json:"servers,omitempty"`
	Paths      map[string]*huma.PathItem `json:"paths"`
	Components subsetComponents          `json:"components"`
}

func (a *API) ServeSubset(path, tag string, info huma.Info, servers []*huma.Server) {
	var once sync.Once
	var body []byte
	var failure error
	a.router.Get(path, func(w http.ResponseWriter, r *http.Request) {
		once.Do(func() {
			body, failure = a.subset(tag, info, servers)
		})
		if failure != nil {
			a.writer.Write(w, r, a.mapper.FromError(r.Context(), failure))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	})
}

func (a *API) subset(tag string, info huma.Info, servers []*huma.Server) ([]byte, error) {
	doc := a.huma.OpenAPI()
	paths := map[string]*huma.PathItem{}
	for path, item := range doc.Paths {
		if kept := tagged(item, tag); kept != nil {
			paths[path] = kept
		}
	}
	raw, err := jsoncodec.Marshal(paths)
	if err != nil {
		return nil, err
	}
	all := doc.Components.Schemas.Map()
	schemas := map[string]*huma.Schema{}
	pending := refsIn(raw)
	for len(pending) > 0 {
		name := pending[0]
		pending = pending[1:]
		schema, ok := all[name]
		if _, done := schemas[name]; done || !ok {
			continue
		}
		schemas[name] = schema
		nested, err := jsoncodec.Marshal(schema)
		if err != nil {
			return nil, err
		}
		pending = append(pending, refsIn(nested)...)
	}
	return jsoncodec.Marshal(subsetDocument{
		OpenAPI: doc.OpenAPI,
		Info:    &info,
		Servers: servers,
		Paths:   paths,
		Components: subsetComponents{
			Schemas:         schemas,
			SecuritySchemes: map[string]*huma.SecurityScheme{"apiKey": doc.Components.SecuritySchemes["apiKey"]},
		},
	})
}

func tagged(item *huma.PathItem, tag string) *huma.PathItem {
	keep := func(op *huma.Operation) *huma.Operation {
		if op != nil && slices.Contains(op.Tags, tag) {
			return op
		}
		return nil
	}
	kept := &huma.PathItem{Get: keep(item.Get), Post: keep(item.Post), Put: keep(item.Put), Patch: keep(item.Patch), Delete: keep(item.Delete)}
	if kept.Get == nil && kept.Post == nil && kept.Put == nil && kept.Patch == nil && kept.Delete == nil {
		return nil
	}
	return kept
}

func refsIn(raw []byte) []string {
	var names []string
	for _, match := range schemaRef.FindAllSubmatch(raw, -1) {
		names = append(names, string(match[1]))
	}
	return names
}
