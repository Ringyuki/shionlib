package developerhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"developer"}

type developerPath struct {
	ID int `path:"id"`
}

type listDevelopersInput struct {
	httpapi.PageQuery
	Q string `query:"q" doc:"Matches names and aliases"`
}

type developerListItemDTO struct {
	ID         int      `json:"id"`
	Name       string   `json:"name"`
	Aliases    []string `json:"aliases"`
	Logo       *string  `json:"logo"`
	WorksCount int      `json:"works_count"`
}

type developerExtraInfoDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type developerDetailDTO struct {
	ID        int                     `json:"id"`
	HID       *int                    `json:"h_id"`
	Name      string                  `json:"name"`
	Aliases   []string                `json:"aliases"`
	Logo      *string                 `json:"logo"`
	IntroJP   string                  `json:"intro_jp"`
	IntroZH   string                  `json:"intro_zh"`
	IntroEN   string                  `json:"intro_en"`
	Website   *string                 `json:"website"`
	ExtraInfo []developerExtraInfoDTO `json:"extra_info"`
}

type Handler struct {
	service *developer.Service
	resp    *response.Builder
}

func NewHandler(service *developer.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "developer.list", Method: http.MethodGet, Path: "/developer/list", Summary: "List developers", Tags: tags}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "developer.get", Method: http.MethodGet, Path: "/developer/{id}", Summary: "Get a developer", Tags: tags}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "developer.delete", Method: http.MethodDelete, Path: "/developer/{id}", Summary: "Delete a developer without games or children", Tags: tags, Access: httpapi.AccessAdmin}, h.delete)
}

func (h *Handler) list(ctx context.Context, in *listDevelopersInput) (*response.Output[response.Page[developerListItemDTO]], error) {
	items, total, err := h.service.List(ctx, in.Q, developer.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	page := response.MapPage(items, total, in.PageSize, in.Page, func(s developer.Summary) developerListItemDTO {
		return developerListItemDTO{ID: s.ID, Name: s.Name, Aliases: nonNil(s.Aliases), Logo: s.Logo, WorksCount: s.WorksCount}
	})
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) get(ctx context.Context, in *developerPath) (*response.Output[developerDetailDTO], error) {
	found, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	extra := make([]developerExtraInfoDTO, len(found.ExtraInfo))
	for i, entry := range found.ExtraInfo {
		extra[i] = developerExtraInfoDTO(entry)
	}
	return response.OK(ctx, h.resp, developerDetailDTO{
		ID: found.ID, HID: found.HID, Name: found.Name, Aliases: nonNil(found.Aliases), Logo: found.Logo,
		IntroJP: found.IntroJP, IntroZH: found.IntroZH, IntroEN: found.IntroEN, Website: found.Website, ExtraInfo: extra,
	}), nil
}

func (h *Handler) delete(ctx context.Context, in *developerPath) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
