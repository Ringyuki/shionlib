package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type PlaygroundHandler struct {
	service *ai.PlaygroundService
	resp    *response.Builder
}

func NewPlaygroundHandler(service *ai.PlaygroundService, resp *response.Builder) *PlaygroundHandler {
	return &PlaygroundHandler{service: service, resp: resp}
}

func (h *PlaygroundHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.playground.run", Method: http.MethodPost, Path: "/admin/ai/playground/runs", Summary: "Run a prompt against scenes, models or routes", Tags: tags, Access: httpapi.AccessSuperAdmin, Status: http.StatusOK}, h.run)
}

func (h *PlaygroundHandler) run(ctx context.Context, in *aiPlaygroundInput) (*response.Output[aiPlaygroundDTO], error) {
	results, err := h.service.Run(ctx, in.run())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toPlaygroundDTO(results)), nil
}
