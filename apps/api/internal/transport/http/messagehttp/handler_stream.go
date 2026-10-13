package messagehttp

import (
	"fmt"
	"io"
	"net/http"
	"reflect"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jsoncodec"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/errmap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

const (
	streamPath             = "/message/stream"
	eventStreamContentType = "text/event-stream"
	unreadEvent            = "message:unread"
	newMessageEvent        = "message:new"
)

func documentStream(oapi *huma.OpenAPI) {
	registry := oapi.Components.Schemas
	events := []*huma.Schema{
		registry.Schema(reflect.TypeFor[messageUnreadEventDTO](), true, ""),
		registry.Schema(reflect.TypeFor[messageNewEventDTO](), true, ""),
	}
	failure := registry.Schema(reflect.TypeFor[errmap.ErrorResponse](), true, "")
	oapi.AddOperation(&huma.Operation{
		OperationID: "message.stream",
		Method:      http.MethodGet,
		Path:        streamPath,
		Summary:     "Follow the caller's messages as server-sent events",
		Description: "Sends " + unreadEvent + " (MessageUnreadEventDTO) on connecting and whenever the count changes, " + newMessageEvent + " (MessageNewEventDTO) when a message arrives, and ping to keep the connection open.",
		Tags:        tags,
		Security:    []map[string][]string{{"accessToken": {}}, {"accessCookie": {}}},
		Responses: map[string]*huma.Response{
			"200":     {Description: "Event stream", Content: map[string]*huma.MediaType{eventStreamContentType: {Schema: &huma.Schema{OneOf: events}}}},
			"default": {Description: "Error", Content: map[string]*huma.MediaType{"application/json": {Schema: failure}}},
		},
	})
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
		header.Set("Content-Type", eventStreamContentType)
		header.Set("Cache-Control", "no-cache")
		header.Set("Connection", "keep-alive")
		header.Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		subscription := h.hub.Subscribe(who.UserID)
		defer subscription.Close()

		if err := writeEvent(w, unreadEvent, messageUnreadEventDTO{Unread: unread}); err != nil {
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
