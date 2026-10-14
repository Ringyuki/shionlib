package bootstrap

import (
	"context"
	"crypto/rand"
	"math/big"
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/bangumi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/characterpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/developerpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sitemappg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/translatorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/bangumiredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/gameredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/searchredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/vndb"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/characterhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/developerhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/searchhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sitemaphttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/translatorhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/gamejobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/searchjobs"
)

const catalogOutboundTimeout = 15 * time.Second

func wireCatalog(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	outbound := httpclient.New(httpclient.Options{Timeout: catalogOutboundTimeout})
	games := gamepg.NewRepository(infra.Ent)
	preferences := gamepg.NewPreferenceStore(infra.Ent)

	gameService := game.NewService(games, gameredis.NewRecentUpdates(infra.Redis), preferences, shared.GameCards, shared.Masker, shared.Now, randomIndex)
	bangumiClient := bangumi.NewClient(bangumi.Options{
		HTTP: outbound,
		Credentials: func() (string, string) {
			return game.BangumiCredentials(shared.Settings, cfg.Bangumi.ClientID, cfg.Bangumi.ClientSecret)
		},
		Tokens: bangumiredis.NewTokenStore(infra.Redis),
		Now:    shared.Now,
	})
	scores := game.NewScoreService(games, bangumiClient, vndb.NewClient(outbound, vndb.DefaultBaseURL), shared.Cache)
	bangumiLink := game.NewBangumiLinkService(bangumiClient, bangumiredis.NewStateStore(infra.Redis), cfg.App.SiteURL, uuid.NewString)
	hotScore := game.NewHotScoreService(games, shared.Settings)

	characters := characterpg.NewRepository(infra.Ent)
	developers := developerpg.NewRepository(infra.Ent)
	searchService := search.NewService(search.Deps{
		Source:      cfg.Catalog.Source,
		Catalog:     shared.Catalog,
		Games:       games,
		Cards:       shared.GameCards,
		Preferences: preferences,
		Developers:  developers,
		Characters:  characters,
		Titles:      searchpg.NewTitleStore(infra.Ent),
		Tags:        searchpg.NewTagStore(infra.Ent),
		Cache:       shared.Cache,
		Queue:       searchJobQueue{queue: shared.Queue},
		Analytics:   searchredis.NewAnalytics(infra.Redis),
	})

	modules.Handlers = append(modules.Handlers,
		gamehttp.NewHandler(gameService, scores, shared.Builder),
		gamehttp.NewBangumiHandler(bangumiLink, shared.Builder, cfg.App.SiteURL, shared.Logger),
		characterhttp.NewHandler(character.NewService(characters, shared.Transactor), shared.Builder),
		developerhttp.NewHandler(developer.NewService(developers, shared.Transactor), shared.Builder),
		translatorhttp.NewHandler(translator.NewService(translatorpg.NewRepository(infra.Ent)), shared.Builder),
		searchhttp.NewHandler(searchService, shared.Builder),
		sitemaphttp.NewHandler(sitemap.NewService(sitemappg.NewStore(infra.Ent), shared.Cache), shared.Builder),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, searchjobs.Register(searchService))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, gamejobs.HotScoreTask(hotScore, shared.Logger))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, searchjobs.Tasks(searchService)...)
}

func randomIndex(n int) int {
	if n <= 1 {
		return 0
	}
	picked, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(picked.Int64())
}

type searchJobQueue struct {
	queue *queue.Queue
}

func (q searchJobQueue) Enqueue(ctx context.Context, job search.RecordSearchJob) error {
	return q.queue.Enqueue(ctx, job)
}
