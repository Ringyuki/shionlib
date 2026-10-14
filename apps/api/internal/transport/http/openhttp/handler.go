package openhttp

import (
	"context"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const (
	Tag      = "open"
	Throttle = "open"
	docPath  = "/open/v1/openapi.json"
)

var tags = []string{Tag}

type Handler struct {
	service *open.Service
	resp    *response.Builder
	site    string
	version string
}

func NewHandler(service *open.Service, resp *response.Builder, site, version string) *Handler {
	return &Handler{service: service, resp: resp, site: strings.TrimSuffix(site, "/"), version: version}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "open.games", Method: http.MethodGet, Path: "/open/v1/games", Summary: "Find games by their Shionlib, Hikarinagi, Bangumi or VNDB IDs, with their resources", Tags: tags, Access: httpapi.AccessKey, Throttle: Throttle}, h.games)
	api.ServeSubset(docPath, Tag, huma.Info{Title: "Shionlib Open API", Version: h.version}, []*huma.Server{{URL: h.site + "/api"}})
}

func (h *Handler) games(ctx context.Context, in *lookupInput) (*response.Output[openLookupDTO], error) {
	kind, values, err := in.lookup()
	if err != nil {
		return nil, err
	}
	result, err := h.service.Lookup(ctx, kind, values)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, h.toLookupDTO(result)), nil
}
