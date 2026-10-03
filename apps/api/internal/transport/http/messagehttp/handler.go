package messagehttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var tags = []string{"message"}

type Handler struct {
	service *message.Service
	hub     *realtime.Hub
	resp    *response.Builder
}

func NewHandler(service *message.Service, hub *realtime.Hub, resp *response.Builder) *Handler {
	return &Handler{service: service, hub: hub, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "message.list", Method: http.MethodGet, Path: "/message/list", Summary: "List the caller's messages", Tags: tags, Access: httpapi.AccessUser}, h.list)
	httpapi.Register(api, httpapi.Route{ID: "message.unread", Method: http.MethodGet, Path: "/message/unread", Summary: "Count unread messages", Tags: tags, Access: httpapi.AccessUser}, h.unread)
	httpapi.Register(api, httpapi.Route{ID: "message.get", Method: http.MethodGet, Path: "/message/{id}", Summary: "Open a message and mark it read", Tags: tags, Access: httpapi.AccessUser}, h.get)
	httpapi.Register(api, httpapi.Route{ID: "message.readAll", Method: http.MethodPost, Path: "/message/all/read", Summary: "Mark every message read", Tags: tags, Access: httpapi.AccessUser}, h.readAll)
	httpapi.Register(api, httpapi.Route{ID: "message.unreadAll", Method: http.MethodPost, Path: "/message/all/unread", Summary: "Mark every message unread", Tags: tags, Access: httpapi.AccessUser}, h.unreadAll)
	httpapi.Register(api, httpapi.Route{ID: "message.read", Method: http.MethodPost, Path: "/message/{id}/read", Summary: "Mark a message read", Tags: tags, Access: httpapi.AccessUser}, h.read)
	if h.hub != nil {
		api.Router().Get("/message/stream", h.stream(api))
	}
}

func (h *Handler) list(ctx context.Context, in *listMessagesInput) (*response.Output[response.Page[messageItemDTO]], error) {
	items, total, err := h.service.List(ctx, actor.From(ctx), in.filter(), message.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := response.MapPage(items, total, in.PageSize, in.Page, func(m message.Message) messageItemDTO {
		return toMessageItem(m, now)
	})
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) unread(ctx context.Context, _ *struct{}) (*response.Output[int], error) {
	count, err := h.service.UnreadCount(ctx, actor.From(ctx))
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, count), nil
}

func (h *Handler) get(ctx context.Context, in *messagePath) (*response.Output[messageDetailDTO], error) {
	detail, err := h.service.Open(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toMessageDetail(detail, h.resp.Now())), nil
}

func (h *Handler) readAll(ctx context.Context, _ *struct{}) (*response.EmptyOutput, error) {
	if err := h.service.MarkAllRead(ctx, actor.From(ctx)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) unreadAll(ctx context.Context, _ *struct{}) (*response.EmptyOutput, error) {
	if err := h.service.MarkAllUnread(ctx, actor.From(ctx)); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) read(ctx context.Context, in *messagePath) (*response.EmptyOutput, error) {
	if err := h.service.MarkRead(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
