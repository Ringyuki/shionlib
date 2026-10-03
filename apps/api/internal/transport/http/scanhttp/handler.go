package scanhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"admin"}

type Handler struct {
	service *scan.Service
	resp    *response.Builder
}

func NewHandler(service *scan.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminMalware.list", Method: http.MethodGet, Path: "/admin/content/malware-scan-cases", Summary: "List malware scan cases", Tags: tags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminMalware.get", Method: http.MethodGet, Path: "/admin/content/malware-scan-cases/{id}", Summary: "Read a malware scan case", Tags: tags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "adminMalware.review", Method: http.MethodPatch, Path: "/admin/content/malware-scan-cases/{id}/review", Summary: "Allow or delete a quarantined file", Tags: tags, Access: httpapi.AccessAdmin}, h.review)
}

func (h *Handler) list(ctx context.Context, in *listMalwareCasesInput) (*response.Output[response.Page[malwareCaseItemDTO]], error) {
	views, total, err := h.service.List(ctx, in.filter(), scan.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(views, total, in.PageSize, in.Page, func(v scan.CaseView) malwareCaseItemDTO {
		return toCaseItem(v, now)
	})), nil
}

func (h *Handler) get(ctx context.Context, in *malwareCasePath) (*response.Output[malwareCaseDetailDTO], error) {
	view, err := h.service.Get(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCaseDetail(view, h.resp.Now())), nil
}

func (h *Handler) review(ctx context.Context, in *reviewMalwareCaseInput) (*response.Output[malwareCaseDetailDTO], error) {
	view, err := h.service.Review(ctx, actor.From(ctx), in.ID, scan.ReviewInput{
		Decision:       in.Body.Decision,
		Note:           in.Body.ReviewNote,
		NotifyUploader: in.Body.NotifyUploader,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toCaseDetail(view, h.resp.Now())), nil
}
