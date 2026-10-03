package cataloghttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"admin-catalog"}

type Handler struct {
	service *catalog.Service
	resp    *response.Builder
}

func NewHandler(service *catalog.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "catalog.sources", Method: http.MethodGet, Path: "/admin/catalog/sources", Summary: "List configured catalog sources", Tags: tags, Access: httpapi.AccessAdmin}, h.sources)
	httpapi.Register(api, httpapi.Route{ID: "catalog.search", Method: http.MethodGet, Path: "/admin/catalog/search", Summary: "Search games at a catalog source", Tags: tags, Access: httpapi.AccessAdmin}, h.search)
	httpapi.Register(api, httpapi.Route{ID: "catalog.import", Method: http.MethodPost, Path: "/admin/catalog/import", Summary: "Import or refresh one catalog entry now", Tags: tags, Access: httpapi.AccessAdmin}, h.importEntry)
	httpapi.Register(api, httpapi.Route{ID: "catalog.enqueue", Method: http.MethodPost, Path: "/admin/catalog/import/queue", Summary: "Queue a catalog entry for import", Tags: tags, Access: httpapi.AccessAdmin}, h.enqueue)
}

func (h *Handler) sources(ctx context.Context, _ *struct{}) (*response.Output[[]string], error) {
	return response.OK(ctx, h.resp, h.service.Sources()), nil
}

func (h *Handler) search(ctx context.Context, in *catalogSearchInput) (*response.Output[response.Page[catalogHitDTO]], error) {
	result, err := h.service.Search(ctx, in.Source, in.Query, in.Page, in.PageSize)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(result.Hits, result.Total, in.PageSize, in.Page, toCatalogHitDTO)), nil
}

func (h *Handler) importEntry(ctx context.Context, in *catalogImportInput) (*response.Output[catalogImportedDTO], error) {
	id, err := h.service.Import(ctx, in.ref())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, catalogImportedDTO{ID: id}), nil
}

func (h *Handler) enqueue(ctx context.Context, in *catalogImportInput) (*response.EmptyOutput, error) {
	if err := h.service.Request(ctx, in.ref()); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
