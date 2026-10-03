package reporthttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"report"}

var adminTags = []string{"admin"}

type Handler struct {
	service *report.Service
	resp    *response.Builder
}

func NewHandler(service *report.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "report.create", Method: http.MethodPost, Path: "/game/download-source/{id}/report", Summary: "Report a download resource", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "adminReport.list", Method: http.MethodGet, Path: "/admin/content/download-resource-reports", Summary: "List download resource reports", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminReport.get", Method: http.MethodGet, Path: "/admin/content/download-resource-reports/{id}", Summary: "Read a download resource report", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "adminReport.review", Method: http.MethodPatch, Path: "/admin/content/download-resource-reports/{id}/review", Summary: "Review a download resource report", Tags: adminTags, Access: httpapi.AccessAdmin}, h.review)
}

func (h *Handler) create(ctx context.Context, in *createReportInput) (*response.Output[reportCreatedDTO], error) {
	created, err := h.service.Create(ctx, actor.From(ctx), in.ID, report.CreateInput{Reason: in.Body.Reason, Detail: in.Body.Detail})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, reportCreatedDTO{
		ID:             created.ID,
		Status:         created.Status,
		Reason:         created.Reason,
		MaliciousLevel: created.Level,
		Created:        created.Created,
	}), nil
}

func (h *Handler) list(ctx context.Context, in *listReportsInput) (*response.Output[response.Page[reportListItemDTO]], error) {
	views, total, err := h.service.List(ctx, in.filter(), report.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(views, total, in.PageSize, in.Page, func(v report.View) reportListItemDTO {
		return toListItemDTO(v, now)
	})), nil
}

func (h *Handler) get(ctx context.Context, in *reportPathInput) (*response.Output[reportDetailDTO], error) {
	view, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDetailDTO(view, h.resp.Now())), nil
}

func (h *Handler) review(ctx context.Context, in *reviewReportInput) (*response.Output[reportDetailDTO], error) {
	view, err := h.service.Review(ctx, actor.From(ctx), in.ID, report.ReviewInput{
		Verdict:        in.Body.Verdict,
		Level:          in.Body.MaliciousLevel,
		Note:           in.Body.ProcessNote,
		Notify:         in.Body.Notify,
		RemoveResource: in.Body.RemoveResource,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDetailDTO(view, h.resp.Now())), nil
}
