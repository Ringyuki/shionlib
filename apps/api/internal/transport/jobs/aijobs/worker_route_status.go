package aijobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
)

const noticeTimeout = time.Minute

type Announcer interface {
	Announce(ctx context.Context, notice ai.RouteStatusNotice) error
}

type RouteStatusWorker struct {
	river.WorkerDefaults[ai.RouteStatusNotice]
	announcer Announcer
}

func NewRouteStatusWorker(announcer Announcer) *RouteStatusWorker {
	return &RouteStatusWorker{announcer: announcer}
}

func (w *RouteStatusWorker) Timeout(*river.Job[ai.RouteStatusNotice]) time.Duration {
	return noticeTimeout
}

func (w *RouteStatusWorker) Work(ctx context.Context, job *river.Job[ai.RouteStatusNotice]) error {
	return w.announcer.Announce(ctx, job.Args)
}
