package refresh_test

import (
	"context"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis/redistest"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/refresh"
)

func start(t *testing.T, watcher *refresh.Watcher) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- watcher.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		if err := <-done; err != nil {
			t.Errorf("run: %v", err)
		}
	})
	<-watcher.Ready()
}

func waitFor(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !condition() {
		if time.Now().After(deadline) {
			t.Fatal("condition was not reached")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestAnnouncementsReloadEveryWatcherOnTheTopic(t *testing.T) {
	client := redistest.New(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	var first, second, other atomic.Int32
	watch := func(topic string, counter *atomic.Int32) *refresh.Watcher {
		return refresh.NewWatcher(client, logger, refresh.Options{Topic: topic, Interval: time.Hour, Reload: func(context.Context) error {
			counter.Add(1)
			return nil
		}})
	}
	a, b, c := watch("settings", &first), watch("settings", &second), watch("elsewhere", &other)
	start(t, a)
	start(t, b)
	start(t, c)
	if first.Load() != 1 || second.Load() != 1 || other.Load() != 1 {
		t.Fatalf("each watcher reloads once it is subscribed: %d %d %d", first.Load(), second.Load(), other.Load())
	}
	a.Announce(t.Context())
	waitFor(t, func() bool { return first.Load() == 2 && second.Load() == 2 })
	time.Sleep(50 * time.Millisecond)
	if other.Load() != 1 {
		t.Fatalf("other topics are not reloaded: %d", other.Load())
	}
}

func TestWatchersReloadOnTheIntervalAndSurviveFailures(t *testing.T) {
	client := redistest.New(t)
	var calls atomic.Int32
	watcher := refresh.NewWatcher(client, slog.New(slog.NewTextHandler(io.Discard, nil)), refresh.Options{Topic: "settings", Interval: 20 * time.Millisecond, Reload: func(context.Context) error {
		calls.Add(1)
		return context.DeadlineExceeded
	}})
	start(t, watcher)
	waitFor(t, func() bool { return calls.Load() >= 3 })
}
