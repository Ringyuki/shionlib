package moyuhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"moyu"}

type Handler struct {
	service *moyu.Service
	resp    *response.Builder
}

func NewHandler(service *moyu.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "moyu.patches", Method: http.MethodGet, Path: "/moyu/game/{gameId}/patches", Summary: "Patches and saved games for a game that 鲲 Galgame 补丁 lists; empty when it lists none", Tags: tags}, h.patches)
}

func (h *Handler) patches(ctx context.Context, in *moyuPatchesInput) (*response.Output[[]moyuEntryDTO], error) {
	entries, err := h.service.Entries(ctx, actor.From(ctx), in.GameID)
	if err != nil {
		return nil, err
	}
	dtos := make([]moyuEntryDTO, len(entries))
	for i, entry := range entries {
		dtos[i] = toEntryDTO(entry)
	}
	return response.OK(ctx, h.resp, dtos), nil
}
