package inspectionhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const (
	imageCacheControl  = "private, max-age=86400"
	noSniff            = "nosniff"
	inertContentPolicy = "default-src 'none'; sandbox"
)

var tags = []string{"inspection"}

type Handler struct {
	service  *inspection.Service
	previews *inspection.PreviewService
	resp     *response.Builder
}

func NewHandler(service *inspection.Service, previews *inspection.PreviewService, resp *response.Builder) *Handler {
	return &Handler{service: service, previews: previews, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "inspection.ofResource", Method: http.MethodGet, Path: "/inspection/resource/{resource_id}", Summary: "What the checks found in the files of a download resource", Tags: tags}, h.ofResource)
	httpapi.Register(api, httpapi.Route{ID: "inspection.entries", Method: http.MethodGet, Path: "/inspection/{id}/entries", Summary: "List the entries inside a folder, archive or disc image of an inspected file", Tags: tags}, h.entries)
	httpapi.Register(api, httpapi.Route{ID: "inspection.search", Method: http.MethodGet, Path: "/inspection/{id}/search", Summary: "Find files of an inspected file by name", Tags: tags}, h.search)
	httpapi.Register(api, httpapi.Route{ID: "inspection.text", Method: http.MethodGet, Path: "/inspection/entry/{entry_id}/text", Summary: "The bytes of a text file kept for preview", Tags: tags}, h.text)
	httpapi.Register(api, httpapi.Route{ID: "inspection.image", Method: http.MethodGet, Path: "/inspection/entry/{entry_id}/image", Summary: "An image kept for preview, as WebP", Tags: tags}, h.image)
}

func (h *Handler) ofResource(ctx context.Context, in *resourceInspectionsInput) (*response.Output[[]inspectionDTO], error) {
	views, err := h.service.OfResource(ctx, actor.From(ctx), in.ResourceID)
	if err != nil {
		return nil, err
	}
	items := make([]inspectionDTO, len(views))
	for i, view := range views {
		items[i] = toInspectionDTO(view)
	}
	return response.OK(ctx, h.resp, items), nil
}

func (h *Handler) entries(ctx context.Context, in *inspectionEntriesInput) (*response.Output[response.Page[inspectionEntryDTO]], error) {
	var parent *int
	if in.ParentID > 0 {
		parent = &in.ParentID
	}
	entries, total, err := h.service.Children(ctx, actor.From(ctx), in.ID, parent, inspection.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(entries, total, in.PageSize, in.Page, toEntryDTO)), nil
}

func (h *Handler) search(ctx context.Context, in *inspectionSearchInput) (*response.Output[response.Page[inspectionFoundDTO]], error) {
	found, total, err := h.service.Search(ctx, actor.From(ctx), in.ID, in.Query, inspection.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, response.MapPage(found, total, in.PageSize, in.Page, toFoundDTO)), nil
}

func (h *Handler) text(ctx context.Context, in *inspectionEntryInput) (*response.Output[inspectionTextDTO], error) {
	preview, err := h.previews.Text(ctx, actor.From(ctx), in.EntryID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, inspectionTextDTO{
		ID:       preview.Entry.ID,
		Name:     preview.Entry.Name,
		Size:     preview.Entry.Size,
		Encoding: preview.Encoding,
		Content:  preview.Data,
	}), nil
}

func (h *Handler) image(ctx context.Context, in *inspectionEntryInput) (*inspectionImageDTO, error) {
	data, err := h.previews.Image(ctx, actor.From(ctx), in.EntryID)
	if err != nil {
		return nil, err
	}
	return &inspectionImageDTO{
		ContentType:     inspection.PreviewImageType,
		CacheControl:    imageCacheControl,
		ContentTypeOpts: noSniff,
		ContentPolicy:   inertContentPolicy,
		Body:            data,
	}, nil
}
