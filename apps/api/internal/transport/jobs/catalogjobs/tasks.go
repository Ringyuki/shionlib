package catalogjobs

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

type Syncer interface {
	RefreshStale(ctx context.Context) error
	PullChanges(ctx context.Context) error
}

func Register(importer Importer) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewImportWorker(importer))
	}
}

func Tasks(syncer Syncer) []jobs.Task {
	return []jobs.Task{
		{Name: "catalog_changes", Schedule: changesSchedule, Timeout: changesTimeout, Run: syncer.PullChanges},
		{Name: "catalog_refresh", Schedule: refreshSchedule, Timeout: refreshTimeout, Run: syncer.RefreshStale},
	}
}
