package refresh

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
)

type Options struct {
	Topic    string
	Interval time.Duration
	Reload   func(ctx context.Context) error
}

type Watcher struct {
	client    *redis.Client
	logger    *slog.Logger
	channel   string
	interval  time.Duration
	reload    func(ctx context.Context) error
	ready     chan struct{}
	readyOnce sync.Once
}

func NewWatcher(client *redis.Client, logger *slog.Logger, opts Options) *Watcher {
	return &Watcher{
		client:   client,
		logger:   logger,
		channel:  client.Key("refresh", opts.Topic),
		interval: opts.Interval,
		reload:   opts.Reload,
		ready:    make(chan struct{}),
	}
}

func (w *Watcher) Ready() <-chan struct{} {
	return w.ready
}

func (w *Watcher) Announce(ctx context.Context) {
	if err := w.client.Publish(ctx, w.channel, "changed").Err(); err != nil {
		w.logger.WarnContext(ctx, "refresh announcement failed; other processes catch up at their next interval", slog.String("channel", w.channel), slog.Any("error", err))
	}
}

func (w *Watcher) Run(ctx context.Context) error {
	pubsub := w.client.Subscribe(ctx, w.channel)
	defer func() {
		_ = pubsub.Close()
	}()
	if _, err := pubsub.Receive(ctx); err != nil {
		return fmt.Errorf("subscribe to %s: %w", w.channel, err)
	}
	w.refresh(ctx)
	w.readyOnce.Do(func() { close(w.ready) })
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	messages := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return nil
		case _, ok := <-messages:
			if !ok {
				return nil
			}
			w.refresh(ctx)
		case <-ticker.C:
			w.refresh(ctx)
		}
	}
}

func (w *Watcher) refresh(ctx context.Context) {
	if err := w.reload(ctx); err != nil && ctx.Err() == nil {
		w.logger.WarnContext(ctx, "refresh failed; keeping the previous snapshot", slog.String("channel", w.channel), slog.Any("error", err))
	}
}
