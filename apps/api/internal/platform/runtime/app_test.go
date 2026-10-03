package runtime_test

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"testing"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/runtime"
)

func TestStopsEveryComponentAndClosesInReverseOrder(t *testing.T) {
	app := runtime.NewApp(slog.New(slog.DiscardHandler), time.Second)
	var closed []string
	app.Close("database", func(context.Context) error { closed = append(closed, "database"); return nil })
	app.Close("server", func(context.Context) error { closed = append(closed, "server"); return nil })
	stopped := make(chan struct{})
	app.Run("waiter", runtime.RunnerFunc(func(ctx context.Context) error {
		<-ctx.Done()
		close(stopped)
		return ctx.Err()
	}))
	app.Run("failing", runtime.RunnerFunc(func(context.Context) error { return errors.New("boom") }))
	err := app.Start(t.Context())
	if err == nil || err.Error() != "failing: boom" {
		t.Fatalf("the failing component is reported: %v", err)
	}
	select {
	case <-stopped:
	default:
		t.Fatal("a failing component cancels the others")
	}
	if !slices.Equal(closed, []string{"server", "database"}) {
		t.Fatalf("closers run in reverse registration order: %v", closed)
	}
}

func TestCancellationIsACleanStop(t *testing.T) {
	app := runtime.NewApp(slog.New(slog.DiscardHandler), time.Second)
	ctx, cancel := context.WithCancel(t.Context())
	app.Run("waiter", runtime.RunnerFunc(func(ctx context.Context) error {
		cancel()
		<-ctx.Done()
		return ctx.Err()
	}))
	failing := errors.New("flush failed")
	app.Close("cache", func(context.Context) error { return failing })
	if err := app.Start(ctx); !errors.Is(err, failing) {
		t.Fatalf("only the close failure is returned: %v", err)
	}
}

func TestClosersGetAFreshDeadline(t *testing.T) {
	app := runtime.NewApp(slog.New(slog.DiscardHandler), 50*time.Millisecond)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	var deadline time.Time
	app.Close("server", func(ctx context.Context) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		deadline, _ = ctx.Deadline()
		return nil
	})
	if err := app.Start(ctx); err != nil {
		t.Fatal(err)
	}
	if deadline.IsZero() || time.Until(deadline) > 50*time.Millisecond {
		t.Fatalf("closers run under the shutdown timeout even after cancellation: %v", deadline)
	}
}
