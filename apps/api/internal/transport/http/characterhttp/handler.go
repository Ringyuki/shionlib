package characterhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"character"}

type Handler struct {
	service *character.Service
	resp    *response.Builder
}

func NewHandler(service *character.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "character.list", Method: http.MethodGet, Path: "/character/list", Summary: "List characters", Tags: tags}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "character.get", Method: http.MethodGet, Path: "/character/{id}", Summary: "Get a character", Tags: tags}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "character.delete", Method: http.MethodDelete, Path: "/character/{id}", Summary: "Delete a character without game relations", Tags: tags, Access: httpapi.AccessAdmin}, h.delete)
}

func (h *Handler) list(ctx context.Context, in *listCharactersInput) (*response.Output[response.Page[characterListItemDTO]], error) {
	items, total, err := h.service.List(ctx, in.Q, character.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(items, total, in.PageSize, in.Page, toListItemDTO)), nil
}

func (h *Handler) get(ctx context.Context, in *characterPath) (*response.Output[characterDetailDTO], error) {
	found, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDetailDTO(found)), nil
}

func (h *Handler) delete(ctx context.Context, in *characterPath) (*response.Output[deletedCharacterDTO], error) {
	deleted, err := h.service.Delete(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDeletedDTO(deleted)), nil
}
