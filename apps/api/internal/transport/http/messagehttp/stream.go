package messagehttp

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/middleware"
)

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

		if err := writeEvent(w, "message:unread", map[string]int{"unread": unread}); err != nil {
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
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", name, data)
	return err
}
