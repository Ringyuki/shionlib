package realtime_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
)

func TestPublishReachesOnlyTheTargetUser(t *testing.T) {
	client := redistest.New(t)
	hub := realtime.NewHub(client, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- hub.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		<-done
	})

	<-hub.Ready()
	alice := hub.Subscribe(1)
	bob := hub.Subscribe(2)
	defer alice.Close()
	defer bob.Close()

	deadline := time.After(3 * time.Second)
	for {
		if err := hub.Publish(ctx, 1, "message:unread", map[string]int{"unread": 3}); err != nil {
			t.Fatal(err)
		}
		select {
		case event := <-alice.Events():
			if event.Name != "message:unread" || string(event.Data) != `{"unread":3}` {
				t.Fatalf("unexpected event %+v", event)
			}
			select {
			case leaked := <-bob.Events():
				t.Fatalf("event leaked to another user: %+v", leaked)
			case <-time.After(100 * time.Millisecond):
			}
			return
		case <-time.After(50 * time.Millisecond):
		case <-deadline:
			t.Fatal("event was not delivered")
		}
	}
}
