package developerhttp

import (
	"context"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *developer.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *developer.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminDeveloper.list", Method: http.MethodGet, Path: "/admin/content/developers", Summary: "List developers for administration", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
}

type adminDeveloperListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the name"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,name,created,updated"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

type adminDeveloperItemDTO struct {
	ID         int       `json:"id"`
	Name       string    `json:"name"`
	Logo       *string   `json:"logo,omitempty"`
	GamesCount int       `json:"gamesCount"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
}

func toAdminDeveloperItemDTO(entry developer.AdminEntry) adminDeveloperItemDTO {
	return adminDeveloperItemDTO{
		ID:         entry.ID,
		Name:       entry.Name,
		Logo:       entry.Logo,
		GamesCount: entry.GamesCount,
		Created:    entry.Created,
		Updated:    entry.Updated,
	}
}

func (h *AdminHandler) list(ctx context.Context, in *adminDeveloperListInput) (*response.Output[response.Page[adminDeveloperItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, developer.AdminFilter{
		Search:     in.Search,
		SortBy:     developer.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}, developer.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminDeveloperItemDTO)), nil
}
