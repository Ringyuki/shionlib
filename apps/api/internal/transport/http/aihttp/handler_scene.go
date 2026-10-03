package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type SceneHandler struct {
	service *ai.SceneService
	resp    *response.Builder
}

func NewSceneHandler(service *ai.SceneService, resp *response.Builder) *SceneHandler {
	return &SceneHandler{service: service, resp: resp}
}

func (h *SceneHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.scene.list", Method: http.MethodGet, Path: "/admin/ai/scenes", Summary: "List AI scenes and their models", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ai.scene.update", Method: http.MethodPut, Path: "/admin/ai/scenes/{key}", Summary: "Configure an AI scene", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.update)
}

func (h *SceneHandler) list(ctx context.Context, _ *struct{}) (*response.Output[[]aiSceneDTO], error) {
	scenes, err := h.service.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]aiSceneDTO, len(scenes))
	for i, scene := range scenes {
		out[i] = toSceneDTO(scene)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *SceneHandler) update(ctx context.Context, in *aiSceneUpdateInput) (*response.Output[aiSceneDTO], error) {
	scene, err := h.service.Update(ctx, in.Key, in.settings())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toSceneDTO(scene)), nil
}
