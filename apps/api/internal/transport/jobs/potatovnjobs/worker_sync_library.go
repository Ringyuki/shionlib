package potatovnjobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

const (
	maxSyncAttempts = 3
	syncTimeout     = 10 * time.Minute
)

type SyncLibraryWorker struct {
	river.WorkerDefaults[potatovn.SyncLibraryJob]
	service *potatovn.Service
}

func NewSyncLibraryWorker(service *potatovn.Service) *SyncLibraryWorker {
	return &SyncLibraryWorker{service: service}
}

func (w *SyncLibraryWorker) Timeout(*river.Job[potatovn.SyncLibraryJob]) time.Duration {
	return syncTimeout
}

func (w *SyncLibraryWorker) Work(ctx context.Context, job *river.Job[potatovn.SyncLibraryJob]) error {
	err := w.service.SyncLibrary(ctx, job.Args.UserID)
	if err != nil && job.Attempt >= maxSyncAttempts {
		return river.JobCancel(err)
	}
	return err
}
