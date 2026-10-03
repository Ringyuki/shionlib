package bootstrap

import (
	"context"
	"crypto/rand"
	"math/big"
	"net/http"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/bangumi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/meilisearch"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/characterpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/developerpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/searchpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sitemappg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/bangumiredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/gameredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/searchredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/vndb"
	"github.com/Ringyuki/shionlib/apps/api/internal/character"
	"github.com/Ringyuki/shionlib/apps/api/internal/developer"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/sitemap"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/characterhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/developerhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/gamehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/searchhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sitemaphttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/gamejobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/searchjobs"
)

const catalogOutboundTimeout = 15 * time.Second

func wireCatalog(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	outbound := httpclient.New(httpclient.Options{Timeout: catalogOutboundTimeout})
	games := gamepg.NewRepository(infra.Ent)
	preferences := gamepg.NewPreferences(infra.Ent)

	gameService := game.NewService(games, gameredis.NewRecentUpdates(infra.Redis), preferences, shared.GameCards, shared.Now, randomIndex)
	scores := game.NewScoreService(games, bangumi.NewClient(bangumi.Options{
		HTTP:         outbound,
		ClientID:     cfg.Bangumi.ClientID,
		ClientSecret: cfg.Bangumi.ClientSecret,
		Tokens:       bangumiredis.NewTokenStore(infra.Redis),
		Now:          shared.Now,
	}), vndb.NewClient(outbound, vndb.DefaultBaseURL), shared.Cache)
	hotScore := game.NewHotScoreService(games, hotScoreWeights(cfg.HotScore))

	searchService := search.NewService(search.Dependencies{
		Engine:      searchEngine(cfg, infra, outbound),
		Catalog:     games,
		Tags:        searchpg.NewTagStore(infra.Ent),
		Cards:       shared.GameCards,
		Preferences: preferences,
		Queue:       searchJobQueue{queue: shared.Queue},
		Analytics:   searchredis.NewAnalytics(infra.Redis),
	})

	modules.Handlers = append(modules.Handlers,
		gamehttp.NewHandler(gameService, scores, shared.Builder),
		characterhttp.NewHandler(character.NewService(characterpg.NewRepository(infra.Ent), shared.Transactor), shared.Builder),
		developerhttp.NewHandler(developer.NewService(developerpg.NewRepository(infra.Ent), shared.Transactor), shared.Builder),
		searchhttp.NewHandler(searchService, shared.Builder),
		sitemaphttp.NewHandler(sitemap.NewService(sitemappg.NewStore(infra.Ent), shared.Cache, shared.Now), cfg.App.SiteURL),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, searchjobs.Register(searchService))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, gamejobs.HotScoreTask(hotScore, shared.Logger))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, searchjobs.Tasks(searchService)...)
}

func searchEngine(cfg *config.Config, infra *Infra, outbound *http.Client) search.Engine {
	if cfg.Search.Engine == "meilisearch" {
		return meilisearch.NewEngine(meilisearch.Options{
			HTTP:   outbound,
			Host:   cfg.Search.MeilisearchHost,
			APIKey: cfg.Search.MeilisearchAPIKey,
			Index:  cfg.Search.MeilisearchIndex,
		})
	}
	return searchpg.NewEngine(infra.Ent)
}

func hotScoreWeights(cfg config.HotScore) game.HotScoreWeights {
	return game.HotScoreWeights{
		HalfLifeReleaseDays: cfg.HalfLifeReleaseDays,
		HalfLifeCreatedDays: cfg.HalfLifeCreatedDays,
		Views:               cfg.WeightViews,
		Downloads:           cfg.WeightDownloads,
		Release:             cfg.WeightRelease,
		Created:             cfg.WeightCreated,
		RecentWindowDays:    cfg.RecentWindowDays,
		RecentViews:         cfg.WeightRecentViews,
		RecentDownloads:     cfg.WeightRecentDownloads,
	}
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
