package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type ModelHandler struct {
	service *ai.ModelService
	resp    *response.Builder
}

func NewModelHandler(service *ai.ModelService, resp *response.Builder) *ModelHandler {
	return &ModelHandler{service: service, resp: resp}
}

func (h *ModelHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.model.list", Method: http.MethodGet, Path: "/admin/ai/models", Summary: "List AI models", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.get", Method: http.MethodGet, Path: "/admin/ai/models/{id}", Summary: "Get an AI model with its routes", Tags: tags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.create", Method: http.MethodPost, Path: "/admin/ai/models", Summary: "Create an AI model from the catalog", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.update", Method: http.MethodPatch, Path: "/admin/ai/models/{id}", Summary: "Update an AI model", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.delete", Method: http.MethodDelete, Path: "/admin/ai/models/{id}", Summary: "Delete an AI model and its routes", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.reorder", Method: http.MethodPut, Path: "/admin/ai/models/{id}/routes", Summary: "Set the failover order of a model's routes", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.reorder)
	httpapi.Register(api, httpapi.Route{ID: "ai.model.addRoute", Method: http.MethodPost, Path: "/admin/ai/models/{id}/routes", Summary: "Add a route to a model", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.addRoute)
}

func (h *ModelHandler) list(ctx context.Context, _ *struct{}) (*response.Output[[]aiModelDTO], error) {
	views, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]aiModelDTO, len(views))
	for i, view := range views {
		out[i] = toModelDTO(view)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *ModelHandler) get(ctx context.Context, in *aiIDPathInput) (*response.Output[aiModelDTO], error) {
	view, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toModelDTO(view)), nil
}

func (h *ModelHandler) create(ctx context.Context, in *aiModelCreateInput) (*response.Output[aiModelDTO], error) {
	view, err := h.service.Create(ctx, in.model())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toModelDTO(view)), nil
}

func (h *ModelHandler) update(ctx context.Context, in *aiModelUpdateInput) (*response.Output[aiModelDTO], error) {
	view, err := h.service.Update(ctx, in.ID, in.update())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toModelDTO(view)), nil
}

func (h *ModelHandler) delete(ctx context.Context, in *aiIDPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *ModelHandler) reorder(ctx context.Context, in *aiModelReorderInput) (*response.Output[aiModelDTO], error) {
	view, err := h.service.Reorder(ctx, in.ID, in.Body.IDs)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toModelDTO(view)), nil
}

func (h *ModelHandler) addRoute(ctx context.Context, in *aiModelAddRouteInput) (*response.Output[aiRouteDTO], error) {
	view, err := h.service.AddRoute(ctx, in.ID, in.source())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toRouteDTO(view)), nil
}
