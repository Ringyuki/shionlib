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
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.create", Method: http.MethodPost, Path: "/walkthrough", Summary: "Create a walkthrough", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.update", Method: http.MethodPatch, Path: "/walkthrough/{id}", Summary: "Replace a walkthrough", Tags: tags, Access: httpapi.AccessUser}, h.update)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.get", Method: http.MethodGet, Path: "/walkthrough/{id}", Summary: "Get a walkthrough", Tags: tags}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.delete", Method: http.MethodDelete, Path: "/walkthrough/{id}", Summary: "Delete a walkthrough", Tags: tags, Access: httpapi.AccessUser}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.listByGame", Method: http.MethodGet, Path: "/walkthrough/game/{id}", Summary: "List walkthroughs of a game", Tags: tags}, h.listByGame)
	httpapi.Register(api, httpapi.Route{ID: "walkthrough.listByUser", Method: http.MethodGet, Path: "/user/datas/{id}/walkthroughs", Summary: "List walkthroughs of a user", Tags: tags}, h.listByUser)
}

func (h *Handler) create(ctx context.Context, in *createWalkthroughInput) (*response.Output[walkthroughDTO], error) {
	created, err := h.service.Create(ctx, actor.From(ctx), walkthrough.CreateInput{
		GameID:  in.Body.GameID,
		Title:   in.Body.Title,
		Content: in.document,
		Status:  walkthrough.Status(in.Body.Status),
	})
	if err != nil {
		return nil, err
	}
	created.Content = nil
	return response.OK(ctx, h.resp, toWalkthrough(created, h.resp.Now())), nil
}

func (h *Handler) update(ctx context.Context, in *updateWalkthroughInput) (*response.Output[walkthroughDTO], error) {
	updated, err := h.service.Update(ctx, actor.From(ctx), in.ID, walkthrough.UpdateInput{
		Title:   in.Body.Title,
		Content: in.document,
		Status:  walkthrough.Status(in.Body.Status),
	})
	if err != nil {
		return nil, err
	}
	updated.Content = nil
	return response.OK(ctx, h.resp, toWalkthrough(updated, h.resp.Now())), nil
}

func (h *Handler) get(ctx context.Context, in *getWalkthroughInput) (*response.Output[walkthroughDTO], error) {
	view, err := h.service.Get(ctx, actor.From(ctx), in.ID, in.WithContent == "true")
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toWalkthrough(view, h.resp.Now())), nil
}

func (h *Handler) delete(ctx context.Context, in *walkthroughPath) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) listByGame(ctx context.Context, in *gameWalkthroughsInput) (*response.Output[walkthroughPageDTO], error) {
	viewer := actor.From(ctx)
	summaries, total, err := h.service.ListByGame(ctx, viewer, in.ID, statusFilter(in.Status), walkthrough.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := walkthroughPageDTO{
		Items: make([]walkthroughItemDTO, len(summaries)),
		Meta:  walkthroughPageMeta{PageMeta: response.NewPageMeta(total, len(summaries), in.PageSize, in.Page), ContentLimit: int(viewer.ContentLimit)},
	}
	for i, summary := range summaries {
		page.Items[i] = toItem(summary, now)
	}
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) listByUser(ctx context.Context, in *userWalkthroughsInput) (*response.Output[userWalkthroughPageDTO], error) {
	viewer := actor.From(ctx)
	summaries, total, err := h.service.ListByCreator(ctx, viewer, in.ID, statusFilter(in.Status), walkthrough.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := userWalkthroughPageDTO{
		Items: make([]userWalkthroughDTO, len(summaries)),
		Meta: userWalkthroughPageMeta{
			PageMeta:      response.NewPageMeta(total, len(summaries), in.PageSize, in.Page),
			IsCurrentUser: in.ID == viewer.UserID,
			ContentLimit:  int(viewer.ContentLimit),
		},
	}
	for i, summary := range summaries {
		page.Items[i] = toUserItem(summary, now)
	}
	return response.OK(ctx, h.resp, page), nil
}
