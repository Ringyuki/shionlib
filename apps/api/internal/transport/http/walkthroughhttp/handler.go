package walkthroughhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

var tags = []string{"walkthrough"}

type Handler struct {
	service *walkthrough.Service
	resp    *response.Builder
}

func NewHandler(service *walkthrough.Service, resp *response.Builder) *Handler {
	return &Handler{service: service, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.write", Method: http.MethodPut, Path: "/walkthrough/game/{id}/mine", Summary: "Write the caller's walkthrough of a game, replacing what they wrote before", Tags: tags, Access: httpapi.AccessUser}, h.write)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.get", Method: http.MethodGet, Path: "/walkthrough/{id}", Summary: "Get a walkthrough", Tags: tags}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.delete", Method: http.MethodDelete, Path: "/walkthrough/{id}", Summary: "Delete a walkthrough", Tags: tags, Access: httpapi.AccessUser}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.listByGame", Method: http.MethodGet, Path: "/walkthrough/game/{id}", Summary: "List the published walkthroughs of a game, the caller's own first even when it is not published, then by latest update", Tags: tags}, h.listByGame)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.listByUser", Method: http.MethodGet, Path: "/user/datas/{id}/walkthroughs", Summary: "List walkthroughs of a user", Tags: tags}, h.listByUser)
}

func (h *Handler) write(ctx context.Context, in *writeWalkthroughInput) (*response.Output[walkthroughDTO], error) {
	written, err := h.service.Write(ctx, actor.From(ctx), in.written())
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toWalkthrough(written, h.resp.Now())), nil
}

func (h *Handler) get(ctx context.Context, in *walkthroughPathInput) (*response.Output[walkthroughDTO], error) {
	view, err := h.service.Get(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toWalkthrough(view, h.resp.Now())), nil
}

func (h *Handler) delete(ctx context.Context, in *walkthroughPathInput) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) listByGame(ctx context.Context, in *walkthroughPathInput) (*response.Output[[]walkthroughSummaryDTO], error) {
	summaries, err := h.service.ListByGame(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	items := make([]walkthroughSummaryDTO, len(summaries))
	for i, summary := range summaries {
		items[i] = toSummary(summary, now)
	}
	return response.OK(ctx, h.resp, items), nil
}

func (h *Handler) listByUser(ctx context.Context, in *userWalkthroughsInput) (*response.Output[userWalkthroughPageDTO], error) {
	viewer := actor.From(ctx)
	summaries, total, err := h.service.ListByCreator(ctx, viewer, in.ID, walkthrough.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	page := userWalkthroughPageDTO{
		Items: make([]userWalkthroughDTO, len(summaries)),
		Meta: userWalkthroughPageMetaDTO{
			PageMeta:      response.NewPageMeta(total, len(summaries), in.PageSize, in.Page),
			IsCurrentUser: in.ID == viewer.UserID,
			ContentLimit:  int(viewer.ContentLimit),
		},
	}
	for i, summary := range summaries {
		page.Items[i] = toUserItem(summary)
	}
	return response.OK(ctx, h.resp, page), nil
}
