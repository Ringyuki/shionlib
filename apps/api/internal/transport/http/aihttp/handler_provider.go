package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"admin-ai"}

type ProviderHandler struct {
	service *ai.ProviderService
	resp    *response.Builder
}

func NewProviderHandler(service *ai.ProviderService, resp *response.Builder) *ProviderHandler {
	return &ProviderHandler{service: service, resp: resp}
}

func (h *ProviderHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.list", Method: http.MethodGet, Path: "/admin/ai/providers", Summary: "List AI providers", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.endpoint", Method: http.MethodGet, Path: "/admin/ai/providers/endpoint", Summary: "Preview the request URL of a provider", Tags: tags, Access: httpapi.AccessAdmin}, h.endpoint)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.get", Method: http.MethodGet, Path: "/admin/ai/providers/{id}", Summary: "Get an AI provider with its routes", Tags: tags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.create", Method: http.MethodPost, Path: "/admin/ai/providers", Summary: "Create an AI provider", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.update", Method: http.MethodPatch, Path: "/admin/ai/providers/{id}", Summary: "Update an AI provider", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.delete", Method: http.MethodDelete, Path: "/admin/ai/providers/{id}", Summary: "Delete an AI provider and its routes", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.discover", Method: http.MethodPost, Path: "/admin/ai/providers/{id}/discovery", Summary: "List the models the provider offers", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.discover)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.addRoutes", Method: http.MethodPost, Path: "/admin/ai/providers/{id}/routes", Summary: "Add routes for upstream models of a provider", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.addRoutes)
	httpapi.Register(api, httpapi.Route{ID: "ai.provider.resolve", Method: http.MethodGet, Path: "/admin/ai/providers/{id}/resolve", Summary: "Match upstream model ids to site models", Tags: tags, Access: httpapi.AccessAdmin}, h.resolve)
}

func (h *ProviderHandler) list(ctx context.Context, _ *struct{}) (*response.Output[[]aiProviderDTO], error) {
	views, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]aiProviderDTO, len(views))
	for i, view := range views {
		out[i] = toProviderDTO(view)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *ProviderHandler) endpoint(ctx context.Context, in *aiEndpointInput) (*response.Output[aiEndpointDTO], error) {
	baseURL := &in.BaseURL
	return response.OK(ctx, h.resp, aiEndpointDTO{URL: h.service.Endpoint(ai.ProviderKind(in.Kind), baseURL)}), nil
}

func (h *ProviderHandler) get(ctx context.Context, in *aiIDPathInput) (*response.Output[aiProviderDetailDTO], error) {
	detail, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toProviderDetailDTO(detail)), nil
}

func (h *ProviderHandler) create(ctx context.Context, in *aiProviderCreateInput) (*response.Output[aiProviderDetailDTO], error) {
	detail, err := h.service.Create(ctx, in.provider())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toProviderDetailDTO(detail)), nil
}

func (h *ProviderHandler) update(ctx context.Context, in *aiProviderUpdateInput) (*response.Output[aiProviderDetailDTO], error) {
	detail, err := h.service.Update(ctx, in.ID, in.update())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toProviderDetailDTO(detail)), nil
}

func (h *ProviderHandler) delete(ctx context.Context, in *aiIDPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *ProviderHandler) discover(ctx context.Context, in *aiIDPathInput) (*response.Output[aiDiscoveryDTO], error) {
	discovery, err := h.service.Discover(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDiscoveryDTO(discovery)), nil
}

func (h *ProviderHandler) addRoutes(ctx context.Context, in *aiAddRoutesInput) (*response.Output[aiAddRoutesDTO], error) {
	result, err := h.service.AddRoutes(ctx, in.ID, in.items())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiAddRoutesDTO{RouteIDs: result.RouteIDs, Skipped: result.Skipped}), nil
}

func (h *ProviderHandler) resolve(ctx context.Context, in *aiResolveInput) (*response.Output[[]aiResolvedModelDTO], error) {
	models, err := h.service.Resolve(ctx, in.ID, in.upstreamIDs())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toResolvedDTOs(models)), nil
}
