package commenthttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *comment.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *comment.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminComment.list", Method: http.MethodGet, Path: "/admin/comments", Summary: "List comments for moderation", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminComment.get", Method: http.MethodGet, Path: "/admin/comments/{id}", Summary: "Read a comment with its moderation history", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "adminComment.setStatus", Method: http.MethodPatch, Path: "/admin/comments/{id}/status", Summary: "Change the moderation status of a comment", Tags: adminTags, Access: httpapi.AccessAdmin}, h.setStatus)
	httpapi.Register(api, httpapi.Route{ID: "adminComment.rescan", Method: http.MethodPost, Path: "/admin/comments/{id}/rescan", Summary: "Send a comment through moderation again", Tags: adminTags, Access: httpapi.AccessAdmin}, h.rescan)
}

func (h *AdminHandler) list(ctx context.Context, in *adminCommentListInput) (*response.Output[response.Page[adminCommentItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, in.filter(), comment.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, func(entry comment.AdminEntry) adminCommentItemDTO {
		return toAdminCommentItem(entry, now)
	})), nil
}

func (h *AdminHandler) get(ctx context.Context, in *adminCommentPath) (*response.Output[adminCommentDetailDTO], error) {
	detail, err := h.service.Detail(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminCommentDetail(detail, h.resp.Now())), nil
}

func (h *AdminHandler) setStatus(ctx context.Context, in *adminCommentStatusInput) (*response.EmptyOutput, error) {
	if err := h.service.SetStatus(ctx, actor.From(ctx), in.ID, in.change()); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) rescan(ctx context.Context, in *adminCommentPath) (*response.EmptyOutput, error) {
	if err := h.service.Rescan(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
