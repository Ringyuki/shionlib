package bootstrap

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aiwalkthrough"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/walkthroughredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/moderationjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/walkthroughjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type commentedResources struct {
	details *download.DetailService
}

func (r commentedResources) Viewable(ctx context.Context, viewer actor.Actor, id int) (comment.ResourceRef, error) {
	resource, err := r.details.Viewable(ctx, viewer, id)
	if err != nil {
		return comment.ResourceRef{}, err
	}
	return comment.ResourceRef{ID: resource.ID, GameID: resource.GameID, CreatorID: resource.CreatorID}, nil
}

func wireContent(infra *Infra, shared *Shared, modules *Modules) {
	classifier, err := aimoderation.NewClassifier(shared.AI)
	if err != nil {
		panic(fmt.Errorf("wire moderation: %w", err))
	}
	moderations := moderation.NewService(moderationpg.NewRepository(infra.Ent), classifier, shared.Messages, shared.Activities, shared.Queue, shared.Transactor)
	commentRepo := commentpg.NewRepository(infra.Ent)
	commented := commentedResources{details: shared.Resources}
	comments := comment.NewService(comment.Deps{
		Repo:      commentRepo,
		Games:     shared.GameCards,
		Resources: commented,
		Messages:  shared.Messages,
		Queue:     shared.Queue,
		Tx:        shared.Transactor,
	})
	pins := comment.NewPinService(commentRepo, commented, shared.Transactor, shared.Now)
	walkthroughs := walkthrough.NewService(walkthroughpg.NewRepository(infra.Ent), shared.GameCards, shared.Activities, shared.Queue, shared.Transactor)
	formatter, err := aiwalkthrough.NewFormatter(shared.AI)
	if err != nil {
		panic(fmt.Errorf("wire walkthrough formatting: %w", err))
	}
	formats := walkthrough.NewFormatService(walkthrough.FormatDeps{
		Games:     shared.GameCards,
		Cast:      walkthroughpg.NewCastStore(infra.Ent),
		Formatter: formatter,
		Tasks:     walkthroughredis.NewFormatTaskStore(infra.Redis),
		Quota:     walkthroughredis.NewFormatQuota(infra.Redis),
		Queue:     shared.Queue,
		Settings:  shared.Settings,
		Now:       infra.Now,
		NewID:     uuid.NewString,
	})

	modules.Handlers = append(modules.Handlers,
		commenthttp.NewHandler(comments, pins, shared.Builder),
		walkthroughhttp.NewHandler(walkthroughs, shared.Builder),
		walkthroughhttp.NewFormatHandler(formats, shared.Builder),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, moderationjobs.Register(moderations), walkthroughjobs.Register(formats))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, moderationjobs.Tasks(moderations, shared.Now)...)
	for name, workers := range moderation.QueueConcurrency() {
		modules.Jobs.Queues[name] = workers
	}
	modules.Jobs.Queues[walkthrough.FormatQueue] = walkthrough.FormatConcurrency
}
