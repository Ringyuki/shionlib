package bootstrap

import (
	"context"
	"path/filepath"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/compositionpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/compositionhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/compositionjobs"
)

const compositionStageDir = ".compose"

type compositionJobQueue struct {
	queue *queue.Queue
}

func (q compositionJobQueue) Enqueue(ctx context.Context, job composition.Job) error {
	return q.queue.Enqueue(ctx, job)
}

func wireComposition(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	files := shared.Files
	composed := download.NewComposedService(files.Downloads, files.Transfers)
	examiner := scan.NewLocalService(files.Scans)
	deps := composition.Deps{
		Repo:      compositionpg.NewRepository(infra.Ent),
		Bases:     composed,
		Listings:  inspection.NewListingService(files.Inspections),
		Uploads:   files.Uploads,
		Quota:     files.Quota,
		Spool:     files.Uploads,
		Examiner:  examiner,
		Resources: composed,
		Names:     files.Names,
		Games:     shared.GameCards,
		Patches:   shared.Patches,
		Objects:   newGameObjectStore(cfg, objectFetchTimeout),
		Archiver:  files.Archives,
		Stage:     localfs.NewStage(filepath.Join(cfg.Upload.RootDir, compositionStageDir)),
		Messages:  shared.Messages,
		Queue:     compositionJobQueue{queue: shared.Queue},
		Tx:        shared.Transactor,
		Settings:  shared.Settings,
		Now:       shared.Now,
	}
	drafts := composition.NewService(deps)
	notices := composition.NewNoticeService(shared.Messages)
	reads := composition.NewReadService(drafts, examiner, shared.Patches, notices)
	runs := composition.NewRunService(deps, notices)

	modules.Handlers = append(modules.Handlers, compositionhttp.NewHandler(drafts, shared.Builder))
	modules.Jobs.Register = append(modules.Jobs.Register, compositionjobs.Register(reads, runs))
	modules.Jobs.Queues[composition.RunQueue] = composition.MaxConcurrency
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, compositionjobs.Tasks(composition.NewCleanService(drafts))...)
}
