package aihttp

import (
	"context"
	"net/http"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type CatalogHandler struct {
	service *ai.CatalogService
	resp    *response.Builder
}

func NewCatalogHandler(service *ai.CatalogService, resp *response.Builder) *CatalogHandler {
	return &CatalogHandler{service: service, resp: resp}
}

func (h *CatalogHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.catalog.status", Method: http.MethodGet, Path: "/admin/ai/catalog", Summary: "Model catalog sync status", Tags: tags, Access: httpapi.AccessAdmin}, h.status)
	httpapi.Register(api, httpapi.Route{ID: "ai.catalog.sync", Method: http.MethodPost, Path: "/admin/ai/catalog/sync", Summary: "Sync the model catalog now", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.sync)
	httpapi.Register(api, httpapi.Route{ID: "ai.catalog.providers", Method: http.MethodGet, Path: "/admin/ai/catalog/providers", Summary: "Catalog providers usable as AI providers", Tags: tags, Access: httpapi.AccessAdmin}, h.providers)
	httpapi.Register(api, httpapi.Route{ID: "ai.catalog.models", Method: http.MethodGet, Path: "/admin/ai/catalog/models", Summary: "Search catalog models and the providers offering them", Tags: tags, Access: httpapi.AccessAdmin}, h.models)
}

func (h *CatalogHandler) status(ctx context.Context, _ *struct{}) (*response.Output[aiCatalogStatusDTO], error) {
	status, err := h.service.Status(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiCatalogStatusDTO{Providers: status.Providers, Models: status.Models, SyncedAt: status.SyncedAt}), nil
}

func (h *CatalogHandler) sync(ctx context.Context, _ *struct{}) (*response.Output[aiCatalogSyncDTO], error) {
	result, err := h.service.Sync(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiCatalogSyncDTO{Providers: result.Providers, Models: result.Models, Added: result.Added, Updated: result.Updated, Removed: result.Removed, Repriced: result.Repriced}), nil
}

func (h *CatalogHandler) providers(ctx context.Context, _ *struct{}) (*response.Output[[]aiCatalogProviderDTO], error) {
	entries, err := h.service.Providers(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]aiCatalogProviderDTO, len(entries))
	for i, entry := range entries {
		out[i] = toCatalogProviderDTO(entry)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *CatalogHandler) models(ctx context.Context, in *aiCatalogModelsInput) (*response.Output[[]aiCatalogModelDTO], error) {
	entries, err := h.service.Models(ctx, strings.TrimSpace(in.Q))
	if err != nil {
		return nil, err
	}
	out := make([]aiCatalogModelDTO, len(entries))
	for i, entry := range entries {
		out[i] = toCatalogModelDTO(entry)
	}
	return response.OK(ctx, h.resp, out), nil
}
