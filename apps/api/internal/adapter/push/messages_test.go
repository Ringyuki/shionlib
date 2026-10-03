package push_test

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/push"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func startHub(t *testing.T) *realtime.Hub {
	t.Helper()
	hub := realtime.NewHub(redistest.New(t), slog.New(slog.DiscardHandler))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- hub.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	<-hub.Ready()
	return hub
}

func receive(t *testing.T, sub *realtime.Subscription, send func()) realtime.Event {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		send()
		select {
		case event := <-sub.Events():
			return event
		case <-time.After(50 * time.Millisecond):
		case <-deadline:
			t.Fatal("event was not delivered")
		}
	}
}

func TestNewMessageEventsUseTheAPITimeFormat(t *testing.T) {
	hub := startHub(t)
	notifier := push.NewMessageNotifier(hub, slog.New(slog.DiscardHandler))
	sub := hub.Subscribe(7)
	defer sub.Close()
	created := time.Date(2026, 10, 3, 9, 2, 3, 456789000, time.FixedZone("CST", 8*60*60))
	event := receive(t, sub, func() {
		notifier.NewMessage(t.Context(), 7, message.Notice{ID: 5, Title: "hello", Type: message.TypeSystem, Tone: message.ToneInfo, Created: created})
	})
	want := `{"id":5,"title":"hello","type":"SYSTEM","tone":"INFO","created":"2026-10-03T01:02:03.456Z"}`
	if event.Name != push.EventNewMessage || string(event.Data) != want {
		t.Fatalf("event %s %s", event.Name, event.Data)
	}
}

func TestUnreadEventsCarryTheCount(t *testing.T) {
	hub := startHub(t)
	notifier := push.NewMessageNotifier(hub, slog.New(slog.DiscardHandler))
	sub := hub.Subscribe(7)
	defer sub.Close()
	event := receive(t, sub, func() { notifier.Unread(t.Context(), 7, 3) })
	if event.Name != push.EventUnreadCount || string(event.Data) != `{"unread":3}` {
		t.Fatalf("event %s %s", event.Name, event.Data)
	}
}
