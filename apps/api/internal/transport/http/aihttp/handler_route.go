package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type RouteHandler struct {
	service *ai.RouteService
	resp    *response.Builder
}

func NewRouteHandler(service *ai.RouteService, resp *response.Builder) *RouteHandler {
	return &RouteHandler{service: service, resp: resp}
}

func (h *RouteHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.route.get", Method: http.MethodGet, Path: "/admin/ai/routes/{id}", Summary: "Get an AI route", Tags: tags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "ai.route.update", Method: http.MethodPatch, Path: "/admin/ai/routes/{id}", Summary: "Update an AI route", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "ai.route.delete", Method: http.MethodDelete, Path: "/admin/ai/routes/{id}", Summary: "Delete an AI route", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "ai.route.check", Method: http.MethodPost, Path: "/admin/ai/routes/{id}/checks", Summary: "Send a test request through a route", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.check)
	httpapi.Register(api, httpapi.Route{ID: "ai.route.revertAdjustment", Method: http.MethodDelete, Path: "/admin/ai/routes/{id}/adjustments/{adjustment_id}", Summary: "Undo an automatic route adjustment", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.revert)
	httpapi.Register(api, httpapi.Route{ID: "ai.route.batch", Method: http.MethodPost, Path: "/admin/ai/routes/batch", Summary: "Enable, disable or delete routes", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.batch)
}

func (h *RouteHandler) get(ctx context.Context, in *aiIDPathInput) (*response.Output[aiRouteDTO], error) {
	view, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toRouteDTO(view)), nil
}

func (h *RouteHandler) update(ctx context.Context, in *aiRouteUpdateInput) (*response.Output[aiRouteDTO], error) {
	view, err := h.service.Update(ctx, in.ID, in.update())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toRouteDTO(view)), nil
}

func (h *RouteHandler) delete(ctx context.Context, in *aiIDPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *RouteHandler) check(ctx context.Context, in *aiIDPathInput) (*response.Output[aiCheckDTO], error) {
	result, err := h.service.Check(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiCheckDTO{OK: result.Failure == nil, Error: toFailureDTO(result.Failure), Route: toRouteDTO(result.Route)}), nil
}

func (h *RouteHandler) revert(ctx context.Context, in *aiAdjustmentPathInput) (*response.Output[aiRouteDTO], error) {
	view, err := h.service.RevertAdjustment(ctx, in.ID, in.AdjustmentID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toRouteDTO(view)), nil
}

func (h *RouteHandler) batch(ctx context.Context, in *aiRouteBatchInput) (*response.Output[aiBatchDTO], error) {
	count, err := h.service.Batch(ctx, in.Body.IDs, ai.RouteBatchAction(in.Body.Action))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiBatchDTO{Count: count}), nil
}
