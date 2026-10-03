package bootstrap

import (
	"fmt"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/moderationjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

func wireContent(infra *Infra, shared *Shared, modules *Modules) {
	classifier, err := aimoderation.NewClassifier(shared.AI)
	if err != nil {
		panic(fmt.Errorf("wire moderation: %w", err))
	}
	moderations := moderation.NewService(moderationpg.NewRepository(infra.Ent), classifier, shared.Messages, shared.Activities, shared.Queue, shared.Transactor)
	comments := comment.NewService(commentpg.NewRepository(infra.Ent), shared.GameCards, shared.Messages, shared.Queue, shared.Transactor)
	walkthroughs := walkthrough.NewService(walkthroughpg.NewRepository(infra.Ent), shared.GameCards, shared.Activities, shared.Queue, shared.Transactor)

	modules.Handlers = append(modules.Handlers,
		commenthttp.NewHandler(comments, shared.Builder),
		walkthroughhttp.NewHandler(walkthroughs, shared.Builder),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, moderationjobs.Register(moderations))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, moderationjobs.Tasks(moderations, shared.Now)...)
	for name, workers := range moderation.QueueConcurrency() {
		modules.Jobs.Queues[name] = workers
	}
}
