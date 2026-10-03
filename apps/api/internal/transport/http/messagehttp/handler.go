package messagehttp

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
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

func (h *Handler) get(ctx context.Context, in *messagePathInput) (*response.Output[messageDetailDTO], error) {
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

func (h *Handler) read(ctx context.Context, in *messagePathInput) (*response.EmptyOutput, error) {
	if err := h.service.MarkRead(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

const keepAliveInterval = 25 * time.Second

func (h *Handler) stream(api *httpapi.API) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if err := middleware.RequireAuthenticated(ctx); err != nil {
			api.ErrorWriter().Write(w, r, api.Mapper().FromError(ctx, err))
			return
		}
		who := actor.From(ctx)
		unread, err := h.service.UnreadCount(ctx, who)
		if err != nil {
			api.ErrorWriter().Write(w, r, api.Mapper().FromError(ctx, err))
			return
		}
		controller := http.NewResponseController(w)
		_ = controller.SetWriteDeadline(time.Time{})
		header := w.Header()
		header.Set("Content-Type", "text/event-stream")
		header.Set("Cache-Control", "no-cache")
		header.Set("Connection", "keep-alive")
		header.Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		subscription := h.hub.Subscribe(who.UserID)
		defer subscription.Close()

		if err := writeEvent(w, "message:unread", unreadEventDTO{Unread: unread}); err != nil {
			return
		}
		if err := controller.Flush(); err != nil {
			return
		}
		ticker := time.NewTicker(keepAliveInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-subscription.Events():
				if !ok {
					return
				}
				if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Name, event.Data); err != nil {
					return
				}
			case <-ticker.C:
				if _, err := io.WriteString(w, "event: ping\ndata: {}\n\n"); err != nil {
					return
				}
			}
			if err := controller.Flush(); err != nil {
				return
			}
		}
	}
}

func writeEvent(w io.Writer, name string, payload any) error {
	data, err := jsoncodec.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", name, data)
	return err
}
