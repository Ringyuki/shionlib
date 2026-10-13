package aihttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type UsageHandler struct {
	service *ai.UsageService
	resp    *response.Builder
}

func NewUsageHandler(service *ai.UsageService, resp *response.Builder) *UsageHandler {
	return &UsageHandler{service: service, resp: resp}
}

func (h *UsageHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ai.usage.overview", Method: http.MethodGet, Path: "/admin/ai/overview", Summary: "AI usage of scenes in a range and the range before it", Tags: tags, Access: httpapi.AccessAdmin}, h.overview)
	httpapi.Register(api, httpapi.Route{ID: "ai.usage.costs", Method: http.MethodGet, Path: "/admin/ai/overview/costs", Summary: "AI cost series by model", Tags: tags, Access: httpapi.AccessAdmin}, h.costs)
	httpapi.Register(api, httpapi.Route{ID: "ai.usage.breakdown", Method: http.MethodGet, Path: "/admin/ai/overview/breakdown", Summary: "AI usage grouped by model, provider, route or scene", Tags: tags, Access: httpapi.AccessAdmin}, h.breakdown)
	httpapi.Register(api, httpapi.Route{ID: "ai.request.list", Method: http.MethodGet, Path: "/admin/ai/requests", Summary: "List AI requests", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ai.request.summary", Method: http.MethodGet, Path: "/admin/ai/requests/summary", Summary: "Statistics of the filtered AI requests", Tags: tags, Access: httpapi.AccessAdmin}, h.summary)
	httpapi.Register(api, httpapi.Route{ID: "ai.request.get", Method: http.MethodGet, Path: "/admin/ai/requests/{id}", Summary: "Get an AI request with its payload and attempts", Tags: tags, Access: httpapi.AccessAdmin}, h.get)
}

func (h *UsageHandler) overview(ctx context.Context, in *aiRangeInput) (*response.Output[aiOverviewDTO], error) {
	overview, err := h.service.Overview(ctx, rangeOf(in.Range))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiOverviewDTO{Current: toStatsDTO(overview.Current), Previous: toStatsDTO(overview.Previous)}), nil
}

func (h *UsageHandler) costs(ctx context.Context, in *aiCostsInput) (*response.Output[aiCostSeriesDTO], error) {
	series, err := h.service.Costs(ctx, rangeOf(in.Range), positive(in.ProviderID), positive(in.ModelID))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCostSeriesDTO(series)), nil
}

func (h *UsageHandler) breakdown(ctx context.Context, in *aiBreakdownInput) (*response.Output[[]aiBreakdownRowDTO], error) {
	rows, err := h.service.Breakdown(ctx, rangeOf(in.Range), ai.Dimension(in.By))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toBreakdownDTOs(rows)), nil
}

func (h *UsageHandler) list(ctx context.Context, in *aiRequestListInput) (*response.Output[response.Page[aiRequestDTO]], error) {
	requests, total, err := h.service.Requests(ctx, in.query(), ai.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.NewPage(toRequestDTOs(requests), total, in.PageSize, in.Page)), nil
}

func (h *UsageHandler) summary(ctx context.Context, in *aiRequestSummaryInput) (*response.Output[aiSummaryDTO], error) {
	summary, err := h.service.Summary(ctx, in.query())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, aiSummaryDTO{Stats: toStatsDTO(summary.Stats), BucketMS: summary.Bucket.Milliseconds(), Buckets: toSeriesDTO(summary.Buckets)}), nil
}

func (h *UsageHandler) get(ctx context.Context, in *aiRequestPathInput) (*response.Output[aiRequestDetailDTO], error) {
	detail, err := h.service.Request(ctx, in.requestID())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toRequestDetailDTO(detail)), nil
}
