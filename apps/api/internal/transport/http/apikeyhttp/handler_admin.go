package apikeyhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/paging"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"api key", "admin"}

type AdminHandler struct {
	service *apikey.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *apikey.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.summary", Method: http.MethodGet, Path: "/admin/open/summary", Summary: "Sum up the use of the open API", Tags: adminTags, Access: httpapi.AccessAdmin}, h.summary)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.usage", Method: http.MethodGet, Path: "/admin/open/usage", Summary: "Requests to the open API by day", Tags: adminTags, Access: httpapi.AccessAdmin}, h.usage)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.list", Method: http.MethodGet, Path: "/admin/open/keys", Summary: "List every API key with its recent use", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.get", Method: http.MethodGet, Path: "/admin/open/keys/{id}", Summary: "Show an API key with its use and its account", Tags: adminTags, Access: httpapi.AccessAdmin}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.suspend", Method: http.MethodPost, Path: "/admin/open/keys/{id}/suspend", Summary: "Suspend an API key and tell its owner why", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.suspend)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.restore", Method: http.MethodPost, Path: "/admin/open/keys/{id}/restore", Summary: "Restore a suspended API key and tell its owner", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.restore)
	httpapi.Register(api, httpapi.Route{ID: "apiKey.admin.accountLimit", Method: http.MethodPut, Path: "/admin/open/accounts/{userId}/limit", Summary: "Give an account a request limit of its own, or follow the site's again", Tags: adminTags, Access: httpapi.AccessAdmin}, h.accountLimit)
}

func (h *AdminHandler) summary(ctx context.Context, _ *struct{}) (*response.Output[openSummaryDTO], error) {
	summary, err := h.service.Summary(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, openSummaryDTO(summary)), nil
}

func (h *AdminHandler) usage(ctx context.Context, in *usageInput) (*response.Output[[]dayDTO], error) {
	days, err := h.service.Days(ctx, in.Days)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toDayDTOs(days)), nil
}

func (h *AdminHandler) list(ctx context.Context, in *listKeysInput) (*response.Output[response.Page[adminKeyDTO]], error) {
	keys, total, err := h.service.List(ctx, in.filter(), paging.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	return response.OK(ctx, h.resp, response.MapPage(keys, total, in.PageSize, in.Page, func(listed apikey.Listed) adminKeyDTO {
		return toAdminKeyDTO(listed, now)
	})), nil
}

func (h *AdminHandler) get(ctx context.Context, in *keyPathInput) (*response.Output[adminKeyDetailDTO], error) {
	detail, err := h.service.Detail(ctx, in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, adminKeyDetailDTO{
		Key:          toAdminKeyDTO(detail.Listed, h.resp.Now()),
		Days:         toDayDTOs(detail.Days),
		Total:        usageDTO(detail.Total),
		AccountLimit: detail.AccountLimit,
		Others:       toKeyDTOs(detail.Others),
	}), nil
}

func (h *AdminHandler) suspend(ctx context.Context, in *suspendKeyInput) (*response.EmptyOutput, error) {
	if err := h.service.Suspend(ctx, actor.From(ctx), in.ID, in.Body.Reason); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) restore(ctx context.Context, in *keyPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Restore(ctx, in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) accountLimit(ctx context.Context, in *accountLimitInput) (*response.EmptyOutput, error) {
	if err := h.service.SetAccountLimit(ctx, in.UserID, in.Body.Limit.Value); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
