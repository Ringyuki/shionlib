package moyuhttp

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"moyu"}

type moyuPatchesInput struct {
	GameID int `path:"gameId" minimum:"1"`
}

type Handler struct {
	service *moyu.Service
	resp    *response.Builder
}

func NewHandler(service *moyu.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "moyu.patches", Method: http.MethodGet, Path: "/moyu/game/{gameId}/patches", Summary: "Community patch resources for a game, forwarded from NextMoe", Tags: tags}, h.patches)
}

func (h *Handler) patches(ctx context.Context, in *moyuPatchesInput) (*response.Output[[]json.RawMessage], error) {
	resources, err := h.service.Resources(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, resources), nil
}
