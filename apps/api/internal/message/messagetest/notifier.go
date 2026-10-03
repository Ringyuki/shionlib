package messagetest

import (
	"context"
	"sync"

	"github.com/Ringyuki/shionlib/apps/api/internal/message"
)

type UnreadEvent struct {
	UserID int
	Count  int
}

type NoticeEvent struct {
	UserID int
	Notice message.Notice
}

type RecordingNotifier struct {
	mu      sync.Mutex
	Notices []NoticeEvent
	Unreads []UnreadEvent
}

func (n *RecordingNotifier) NewMessage(_ context.Context, receiverID int, notice message.Notice) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.Notices = append(n.Notices, NoticeEvent{UserID: receiverID, Notice: notice})
}

func (n *RecordingNotifier) Unread(_ context.Context, receiverID int, count int) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.Unreads = append(n.Unreads, UnreadEvent{UserID: receiverID, Count: count})
}
