package analysishttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"analysis"}

type Handler struct {
	service *analysis.Service
	resp    *response.Builder
}

func NewHandler(service *analysis.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "analysis.overview", Method: http.MethodGet, Path: "/analysis/data/overview", Summary: "Site totals and 24-hour traffic", Tags: tags}, h.overview)
	httpapi.Register(api, httpapi.Route{ID: "analysis.trafficDetail", Method: http.MethodGet, Path: "/analysis/data/traffic-detail", Summary: "Download traffic of the last 24 hours", Tags: tags}, h.trafficDetail)
}

func (h *Handler) overview(ctx context.Context, _ *struct{}) (*response.Output[analysisOverviewDTO], error) {
	overview, err := h.service.Overview(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, analysisOverviewDTO{
		Games:       overview.Games,
		Files:       overview.Files,
		Resources:   overview.Resources,
		Storage:     overview.StorageBytes,
		BytesGotten: overview.BytesServed,
	}), nil
}

func (h *Handler) trafficDetail(ctx context.Context, _ *struct{}) (*response.Output[analysisTrafficDTO], error) {
	detail, err := h.service.TrafficDetail(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toTrafficDTO(detail)), nil
}
