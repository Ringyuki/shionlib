package uploadhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	uploads *download.UploadService
	resp    *response.Builder
}

func NewAdminHandler(uploads *download.UploadService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{uploads: uploads, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminUpload.list", Method: http.MethodGet, Path: "/admin/uploads", Summary: "List the uploads of every user, newest first, with failures reported before a session was opened", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminUpload.get", Method: http.MethodGet, Path: "/admin/uploads/{id}", Summary: "Read an upload session with the file made from it and the failures reported for it", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "adminUpload.attempt", Method: http.MethodGet, Path: "/admin/uploads/attempts/{id}", Summary: "Read a failure reported before an upload session was opened", Tags: adminTags, Access: httpapi.AccessAdmin}, h.attempt)
	httpapi.Register(api, httpapi.Route{ID: "adminUpload.terminate", Method: http.MethodPost, Path: "/admin/uploads/{id}/terminate", Summary: "End an upload in progress or not yet submitted and discard what was uploaded", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.terminate)
}

func (h *AdminHandler) list(ctx context.Context, in *adminUploadListInput) (*response.Output[response.Page[AdminUploadItemDTO]], error) {
	entries, total, err := h.uploads.List(ctx, in.filter(), download.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminUploadItem)), nil
}

func (h *AdminHandler) get(ctx context.Context, in *adminUploadPathInput) (*response.Output[adminUploadDTO], error) {
	detail, err := h.uploads.Session(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminUpload(detail)), nil
}

func (h *AdminHandler) attempt(ctx context.Context, in *adminUploadPathInput) (*response.Output[adminUploadDTO], error) {
	detail, err := h.uploads.Attempt(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toAdminUpload(detail)), nil
}

func (h *AdminHandler) terminate(ctx context.Context, in *adminUploadPathInput) (*response.EmptyOutput, error) {
	if err := h.uploads.Terminate(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
