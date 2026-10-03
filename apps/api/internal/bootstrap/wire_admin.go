package bootstrap

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/argon2hash"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adminpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/characterpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/commentpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/developerpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/userpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/walkthroughpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/gameredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/comment"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adminhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/characterhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/commenthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/developerhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/walkthroughhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

type objectPurgeQueue struct {
	queue *queue.Queue
	now   func() time.Time
}

func (q objectPurgeQueue) PurgeLater(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	return q.queue.Enqueue(ctx, download.PurgeObjects{Keys: keys, Before: q.now()})
}

func wireAdmin(infra *Infra, shared *Shared, modules *Modules) {
	games := game.NewAdminService(
		gamepg.NewAdminStore(infra.Ent),
		gameredis.NewRecentUpdates(infra.Redis),
		shared.Catalog,
		objectPurgeQueue{queue: shared.Queue, now: shared.Now},
		shared.Transactor,
		shared.Now,
	)
	users := admin.NewUserService(admin.UserDeps{
		Accounts:    userpg.NewRepository(infra.Ent),
		Store:       adminpg.NewUserStore(infra.Ent),
		Permissions: adminpg.NewPermissionStore(infra.Ent),
		Bans:        shared.Users,
		Sessions:    shared.Sessions,
		Passwords:   argon2hash.New(argon2hash.PasswordParams()),
		Quotas:      upload.NewQuotaService(uploadpg.NewQuotaRepository(infra.Ent), shared.Transactor, quotaPolicy(shared.Config), shared.Now),
		Tx:          shared.Transactor,
	})
	comments := commentpg.NewRepository(infra.Ent)
	walkthroughs := walkthroughpg.NewRepository(infra.Ent)

	modules.Handlers = append(modules.Handlers,
		gamehttp.NewAdminHandler(games, shared.Builder),
		characterhttp.NewAdminHandler(character.NewAdminService(characterpg.NewRepository(infra.Ent)), shared.Builder),
		developerhttp.NewAdminHandler(developer.NewAdminService(developerpg.NewRepository(infra.Ent)), shared.Builder),
		adminhttp.NewStatsHandler(admin.NewStatsService(adminpg.NewStatsStore(infra.Ent), shared.Cache, shared.Now), shared.Builder),
		adminhttp.NewUserHandler(users, shared.Builder),
		commenthttp.NewAdminHandler(comment.NewAdminService(comments, comments, shared.Messages, shared.Activities, shared.Queue, shared.Transactor), shared.Builder),
		walkthroughhttp.NewAdminHandler(walkthrough.NewAdminService(walkthroughs, walkthroughs, shared.Queue, shared.Transactor), shared.Builder),
	)
}
