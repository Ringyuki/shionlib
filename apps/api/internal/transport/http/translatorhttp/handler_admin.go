package translatorhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/patch"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var adminTags = []string{"admin"}

type AdminHandler struct {
	service *translator.AdminService
	resp    *response.Builder
}

func NewAdminHandler(service *translator.AdminService, resp *response.Builder) *AdminHandler {
	return &AdminHandler{service: service, resp: resp}
}

func (h *AdminHandler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "adminTranslator.list", Method: http.MethodGet, Path: "/admin/content/translators", Summary: "List translators for administration", Tags: adminTags, Access: httpapi.AccessAdmin}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "adminTranslator.duplicates", Method: http.MethodGet, Path: "/admin/content/translators/duplicates", Summary: "List translators whose names differ only in writing", Tags: adminTags, Access: httpapi.AccessAdmin}, h.duplicates)
	httpapi.Register(api, httpapi.Route{ID: "adminTranslator.dismiss", Method: http.MethodPost, Path: "/admin/content/translators/duplicates/dismiss", Summary: "Record that similar names are different translators", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.dismiss)
	httpapi.Register(api, httpapi.Route{ID: "adminTranslator.edit", Method: http.MethodPatch, Path: "/admin/content/translators/{id}", Summary: "Edit a translator", Tags: adminTags, Access: httpapi.AccessAdmin}, h.edit)
	httpapi.Register(api, httpapi.Route{ID: "adminTranslator.merge", Method: http.MethodPost, Path: "/admin/content/translators/{id}/merge", Summary: "Merge other translators into this one", Tags: adminTags, Access: httpapi.AccessAdmin, Status: http.StatusOK}, h.merge)
}

func (h *AdminHandler) list(ctx context.Context, in *adminTranslatorListInput) (*response.Output[response.Page[adminTranslatorItemDTO]], error) {
	entries, total, err := h.service.Search(ctx, translator.AdminFilter{
		Search:     in.Search,
		SortBy:     translator.SortField(in.SortBy),
		Descending: in.SortOrder != "asc",
	}, translator.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toAdminTranslatorItemDTO)), nil
}

func (h *AdminHandler) duplicates(ctx context.Context, _ *struct{}) (*response.Output[[]adminTranslatorClusterDTO], error) {
	found, err := h.service.Duplicates(ctx)
	if err != nil {
		return nil, err
	}
	clusters := make([]adminTranslatorClusterDTO, len(found))
	for i, entries := range found {
		clusters[i] = toAdminTranslatorClusterDTO(entries)
	}
	return response.OK(ctx, h.resp, clusters), nil
}

func (h *AdminHandler) dismiss(ctx context.Context, in *adminTranslatorDismissInput) (*response.EmptyOutput, error) {
	if err := h.service.Dismiss(ctx, in.Body.IDs); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) edit(ctx context.Context, in *adminTranslatorEditInput) (*response.EmptyOutput, error) {
	changes := translator.Changes{Name: in.Body.Name, Aliases: in.Body.Aliases, Homepage: patch.Clearable[string]{Set: in.Body.Homepage != nil, Value: in.Body.Homepage}}
	if err := h.service.Edit(ctx, in.ID, changes); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *AdminHandler) merge(ctx context.Context, in *adminTranslatorMergeInput) (*response.EmptyOutput, error) {
	if err := h.service.Merge(ctx, in.ID, in.Body.MergedIDs); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
