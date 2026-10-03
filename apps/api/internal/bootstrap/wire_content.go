package bootstrap

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/openai"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moderationpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/moderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/moderationjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const openAITimeout = 5 * time.Minute

func wireContent(infra *Infra, shared *Shared, modules *Modules) {
	settings := shared.Config.OpenAI
	if settings.APIKey == "" && !infra.Offline {
		shared.Logger.Warn("OPENAI_API_KEY is empty: content moderation is disabled and new comments and walkthroughs are published without review")
	}
	classifier := openai.NewClient(httpclient.New(httpclient.Options{Timeout: openAITimeout}), openai.Options{
		APIKey:          settings.APIKey,
		BaseURL:         settings.BaseURL,
		ModerationModel: settings.ModerationModel,
		ReviewModel:     settings.ReviewModel,
	})
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
