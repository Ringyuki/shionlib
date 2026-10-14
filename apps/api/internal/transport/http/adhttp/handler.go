package adhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"ad"}

var adminTags = []string{"ad", "admin"}

type Handler struct {
	service    *ad.Service
	placements *ad.PlacementService
	resp       *response.Builder
}

func NewHandler(service *ad.Service, placements *ad.PlacementService, resp *response.Builder) *Handler {
	return &Handler{service: service, placements: placements, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "ad.slots", Method: http.MethodGet, Path: "/ad/slots", Summary: "The ads a page shows in its slots, chosen for the viewer; empty for sponsors and when ads are off", Tags: tags}, h.slots)
	httpapi.Register(api, httpapi.Route{ID: "ad.views", Method: http.MethodPost, Path: "/ad/views", Summary: "Count the ads a visitor saw", Tags: tags, Status: http.StatusOK}, h.views)
	httpapi.Register(api, httpapi.Route{ID: "ad.click", Method: http.MethodPost, Path: "/ad/{id}/click", Summary: "Count a click on an ad and return where it leads", Tags: tags, Status: http.StatusOK}, h.click)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.list", Method: http.MethodGet, Path: "/admin/ad", Summary: "List ads with their counts of the last seven days", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.overview", Method: http.MethodGet, Path: "/admin/ad/overview", Summary: "How many ads run, their counts of the last seven days and whether ads are on", Tags: adminTags, Access: httpapi.AccessAdmin}, h.overview)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.slots", Method: http.MethodGet, Path: "/admin/ad/slots", Summary: "Every slot with the ads running in it and its counts of the last seven days", Tags: adminTags, Access: httpapi.AccessAdmin}, h.slotSummaries)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.get", Method: http.MethodGet, Path: "/admin/ad/{id}", Summary: "Get an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.report", Method: http.MethodGet, Path: "/admin/ad/{id}/report", Summary: "Daily and per-slot counts of an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.report)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.create", Method: http.MethodPost, Path: "/admin/ad", Summary: "Create an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.replace", Method: http.MethodPut, Path: "/admin/ad/{id}", Summary: "Replace every field of an ad", Tags: adminTags, Access: httpapi.AccessAdmin}, h.replace)
	httpapi.Register(api, httpapi.Route{ID: "ad.admin.delete", Method: http.MethodDelete, Path: "/admin/ad/{id}", Summary: "Delete an ad and its counts", Tags: adminTags, Access: httpapi.AccessAdmin}, h.delete)
}

func (h *Handler) slots(ctx context.Context, in *slotsInput) (*response.Output[[]adPlacedDTO], error) {
	placed, err := h.placements.Place(ctx, actor.From(ctx), in.Locale, in.slots())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toPlacedDTOs(placed)), nil
}

func (h *Handler) views(ctx context.Context, in *adViewsInput) (*response.EmptyOutput, error) {
	if err := h.placements.RecordViews(ctx, in.views()); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) click(ctx context.Context, in *adClickInput) (*response.Output[adClickDTO], error) {
	info := clientinfo.From(ctx)
	link, err := h.placements.Click(ctx, in.ID, ad.Slot(in.Body.Slot), ad.Visitor{IP: info.IP, UserAgent: info.UserAgent})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adClickDTO{Link: link}), nil
}

func (h *Handler) list(ctx context.Context, in *listInput) (*response.Output[response.Page[adminAdDTO]], error) {
	listed, total, err := h.service.List(ctx, in.filter(), ad.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(listed, total, in.PageSize, in.Page, func(item ad.Listed) adminAdDTO {
		dto := toAdminDTO(item.Ad, now)
		dto.Week = toCountsDTO(item.Week)
		return dto
	})), nil
}

func (h *Handler) overview(ctx context.Context, _ *struct{}) (*response.Output[adOverviewDTO], error) {
	overview, err := h.service.Overview(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adOverviewDTO{Running: overview.Running, Week: toCountsDTO(overview.Week), Enabled: overview.Enabled}), nil
}

func (h *Handler) slotSummaries(ctx context.Context, _ *struct{}) (*response.Output[[]adSlotSummaryDTO], error) {
	summaries, err := h.service.Slots(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toSlotSummaryDTOs(summaries)), nil
}

func (h *Handler) get(ctx context.Context, in *pathInput) (*response.Output[adminAdDTO], error) {
	item, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(item, h.resp.Now())), nil
}

func (h *Handler) report(ctx context.Context, in *reportInput) (*response.Output[adReportDTO], error) {
	report, err := h.service.Report(ctx, in.ID, in.Days)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toReportDTO(report)), nil
}

func (h *Handler) create(ctx context.Context, in *createInput) (*response.Output[adminAdDTO], error) {
	created, err := h.service.Create(ctx, in.Body.draft())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(created, h.resp.Now())), nil
}

func (h *Handler) replace(ctx context.Context, in *replaceInput) (*response.Output[adminAdDTO], error) {
	replaced, err := h.service.Replace(ctx, in.ID, in.Body.draft())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminDTO(replaced, h.resp.Now())), nil
}

func (h *Handler) delete(ctx context.Context, in *pathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
