package walkthroughhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *walkthrough.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *walkthrough.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminWalkthrough.list", Method: http.MethodGet, Path: "/admin/walkthroughs", Summary: "List walkthroughs for moderation", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminWalkthrough.get", Method: http.MethodGet, Path: "/admin/walkthroughs/{id}", Summary: "Read a walkthrough with its moderation history", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "adminWalkthrough.setStatus", Method: http.MethodPatch, Path: "/admin/walkthroughs/{id}/status", Summary: "Change the status of a walkthrough", Tags: adminTags, Access: httpapi.AccessAdmin}, h.setStatus)
	httpapi.Register(api, httpapi.Route{ID: "adminWalkthrough.rescan", Method: http.MethodPost, Path: "/admin/walkthroughs/{id}/rescan", Summary: "Send a walkthrough through moderation again", Tags: adminTags, Access: httpapi.AccessAdmin}, h.rescan)
}

func (h *AdminHandler) list(ctx context.Context, in *adminWalkthroughListInput) (*response.Output[response.Page[adminWalkthroughItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, in.filter(), walkthrough.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, func(entry walkthrough.AdminEntry) adminWalkthroughItemDTO {
		return toAdminWalkthroughItem(entry, now)
	})), nil
}

func (h *AdminHandler) get(ctx context.Context, in *adminWalkthroughPathInput) (*response.Output[adminWalkthroughDetailDTO], error) {
	detail, err := h.service.Detail(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminWalkthroughDetail(detail, h.resp.Now())), nil
}

func (h *AdminHandler) setStatus(ctx context.Context, in *adminWalkthroughStatusInput) (*response.EmptyOutput, error) {
	if err := h.service.SetStatus(ctx, in.ID, walkthrough.Status(in.Body.Status)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) rescan(ctx context.Context, in *adminWalkthroughPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Rescan(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
