package sitemaphttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"site"}

type Handler struct {
	service *sitemap.Service
	resp    *response.Builder
}

func NewHandler(service *sitemap.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "sitemap.sections", Method: http.MethodGet, Path: "/sitemap/sections", Summary: "Sections of the sitemap and how many pages each has", Tags: tags}, h.sections)
	httpapi.Register(api, httpapi.Route{ID: "sitemap.entries", Method: http.MethodGet, Path: "/sitemap/{section}/{page}", Summary: "Entries of one sitemap page", Tags: tags}, h.entries)
}

func (h *Handler) sections(ctx context.Context, _ *struct{}) (*response.Output[[]sitemapSectionDTO], error) {
	sections, err := h.service.Sections(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]sitemapSectionDTO, len(sections))
	for i, section := range sections {
		out[i] = sitemapSectionDTO{Section: string(section.Section), Pages: section.Pages}
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) entries(ctx context.Context, in *sitemapEntriesInput) (*response.Output[[]sitemapEntryDTO], error) {
	entries, err := h.service.Entries(ctx, sitemap.Section(in.Section), in.Page)
	if err != nil {
		return nil, err
	}
	out := make([]sitemapEntryDTO, len(entries))
	for i, entry := range entries {
		out[i] = toEntryDTO(entry)
	}
	return response.OK(ctx, h.resp, out), nil
}
