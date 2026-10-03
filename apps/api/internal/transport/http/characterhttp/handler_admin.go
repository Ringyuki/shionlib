package characterhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *character.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *character.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminCharacter.list", Method: http.MethodGet, Path: "/admin/content/characters", Summary: "List characters for administration", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
}

func (h *AdminHandler) list(ctx context.Context, in *adminCharacterListInput) (*response.Output[response.Page[adminCharacterItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, character.AdminFilter{
		Search:     in.Search,
		SortBy:     character.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}, character.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminCharacterItemDTO)), nil
}
