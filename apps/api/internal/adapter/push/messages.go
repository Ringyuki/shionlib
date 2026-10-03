package push

import (
	"context"
	"log/slog"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
)

const (
	EventNewMessage  = "message:new"
	EventUnreadCount = "message:unread"
)

type UnreadPayload struct {
	Unread int `json:"unread"`
}

type MessageNotifier struct {
	hub    *realtime.Hub
	logger *slog.Logger
}

func NewMessageNotifier(hub *realtime.Hub, logger *slog.Logger) *MessageNotifier {
	return &MessageNotifier{hub: hub, logger: logger}
}

func (n *MessageNotifier) NewMessage(ctx context.Context, receiverID int, notice message.Notice) {
	if err := n.hub.Publish(ctx, receiverID, EventNewMessage, notice); err != nil {
		n.logger.WarnContext(ctx, "push new message failed", slog.Int("receiver_id", receiverID), slog.Any("error", err))
	}
}

func (n *MessageNotifier) Unread(ctx context.Context, receiverID int, count int) {
	if err := n.hub.Publish(ctx, receiverID, EventUnreadCount, UnreadPayload{Unread: count}); err != nil {
		n.logger.WarnContext(ctx, "push unread count failed", slog.Int("receiver_id", receiverID), slog.Any("error", err))
	}
}
