package searchjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

const indexTimeout = 2 * time.Minute

type Refresher interface {
	Refresh(ctx context.Context, ids []int) error
}

type IndexWorker struct {
	river.WorkerDefaults[search.IndexJob]
	indexer Refresher
}

func NewIndexWorker(indexer Refresher) *IndexWorker {
	return &IndexWorker{indexer: indexer}
}

func (w *IndexWorker) Timeout(*river.Job[search.IndexJob]) time.Duration {
	return indexTimeout
}

func (w *IndexWorker) Work(ctx context.Context, job *river.Job[search.IndexJob]) error {
	return w.indexer.Refresh(ctx, job.Args.GameIDs)
}
