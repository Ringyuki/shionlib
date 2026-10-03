package characterhttp

import (
	"context"
	"net/http"
	"time"

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

type adminCharacterListInput struct {
	httpapi.PageQuery
	Search    string `query:"search" doc:"Case-insensitive substring of the Japanese, Chinese or English name"`
	SortBy    string `query:"sortBy" default:"id" enum:"id,name,created,updated" doc:"name sorts by the Japanese name"`
	SortOrder string `query:"sortOrder" default:"desc" enum:"asc,desc"`
}

type adminCharacterItemDTO struct {
	ID         int       `json:"id"`
	NameJP     string    `json:"name_jp"`
	NameZH     *string   `json:"name_zh"`
	NameEN     *string   `json:"name_en"`
	Image      *string   `json:"image,omitempty"`
	Gender     []string  `json:"gender"`
	GamesCount int       `json:"gamesCount"`
	Created    time.Time `json:"created"`
	Updated    time.Time `json:"updated"`
}

func toAdminCharacterItemDTO(entry character.AdminEntry) adminCharacterItemDTO {
	gender := entry.Gender
	if gender == nil {
		gender = []string{}
	}
	return adminCharacterItemDTO{
		ID:         entry.ID,
		NameJP:     entry.NameJP,
		NameZH:     entry.NameZH,
		NameEN:     entry.NameEN,
		Image:      entry.Image,
		Gender:     gender,
		GamesCount: entry.GamesCount,
		Created:    entry.Created,
		Updated:    entry.Updated,
	}
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
