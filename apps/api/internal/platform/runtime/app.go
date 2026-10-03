package runtime

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"
)

type Runner interface {
	Run(ctx context.Context) error
}

type RunnerFunc func(ctx context.Context) error

func (f RunnerFunc) Run(ctx context.Context) error {
	return f(ctx)
}

type Closer func(ctx context.Context) error

type namedRunner struct {
	name   string
	runner Runner
}

type namedCloser struct {
	name   string
	closer Closer
}

type App struct {
	logger          *slog.Logger
	shutdownTimeout time.Duration
	runners         []namedRunner
	closers         []namedCloser
}

func NewApp(logger *slog.Logger, shutdownTimeout time.Duration) *App {
	return &App{logger: logger, shutdownTimeout: shutdownTimeout}
}

func (a *App) Run(name string, runner Runner) {
	a.runners = append(a.runners, namedRunner{name: name, runner: runner})
}

func (a *App) Close(name string, closer Closer) {
	a.closers = append(a.closers, namedCloser{name: name, closer: closer})
}

func (a *App) Start(parent context.Context) error {
	ctx, stop := signal.NotifyContext(parent, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	group, groupCtx := errgroup.WithContext(ctx)
	for _, entry := range a.runners {
		group.Go(func() error {
			a.logger.InfoContext(groupCtx, "component starting", slog.String("component", entry.name))
			if err := entry.runner.Run(groupCtx); err != nil && !errors.Is(err, context.Canceled) {
				return fmt.Errorf("%s: %w", entry.name, err)
			}
			a.logger.InfoContext(groupCtx, "component stopped", slog.String("component", entry.name))
			return nil
		})
	}
	runErr := group.Wait()

	closeCtx, cancel := context.WithTimeout(context.WithoutCancel(parent), a.shutdownTimeout)
	defer cancel()
	closeErr := a.closeAll(closeCtx)
	return errors.Join(runErr, closeErr)
}

func (a *App) closeAll(ctx context.Context) error {
	var errs []error
	for i := len(a.closers) - 1; i >= 0; i-- {
		entry := a.closers[i]
		if err := entry.closer(ctx); err != nil {
			errs = append(errs, fmt.Errorf("close %s: %w", entry.name, err))
			continue
		}
		a.logger.InfoContext(ctx, "component closed", slog.String("component", entry.name))
	}
	return errors.Join(errs...)
}
