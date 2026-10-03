package bootstrap

import (
	"time"

	"github.com/google/uuid"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/aimoderation"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/llm"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/modelsdev"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/aipg"
	"github.com/Ringyuki/shionlib/apps/api/internal/ai"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/aihttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/aijobs"
)

const (
	aiCatalogTimeout    = 2 * time.Minute
	aiCatalogStaleAfter = 20 * time.Hour
	aiCatalogSearch     = 40
	aiBreakdownLimit    = 50
	aiCostSeries        = 5
	day                 = 24 * time.Hour
)

func wireAI(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config.AI
	repo := aipg.NewRepository(infra.Ent)
	requests := aipg.NewRequestStore(infra.Ent)
	stats := aipg.NewStatsStore(infra.Ent)
	gateway := ai.NewService(ai.Deps{
		Scenes:   aimoderation.Scenes,
		Repo:     repo,
		Requests: requests,
		Upstream: llm.NewClient(httpclient.New(httpclient.Options{Timeout: cfg.MaxCallDuration})),
		Queue:    shared.Queue,
		Now:      infra.Now,
		NewID:    uuid.NewString,
		Options:  ai.Options{IdleTimeout: cfg.IdleTimeout, RecordPayloads: cfg.RecordPayloads},
	})
	catalog := ai.NewCatalogService(ai.CatalogDeps{
		Source:  modelsdev.NewClient(httpclient.New(httpclient.Options{Timeout: aiCatalogTimeout}), cfg.CatalogURL),
		Store:   aipg.NewCatalogStore(infra.Ent),
		Repo:    repo,
		Tx:      shared.Transactor,
		Now:     infra.Now,
		Options: ai.CatalogOptions{StaleAfter: aiCatalogStaleAfter, SearchLimit: aiCatalogSearch},
	})
	probe := ai.NewProbeService(gateway, repo, shared.Queue, infra.Now)
	routes := ai.NewRouteService(ai.RouteDeps{Repo: repo, Stats: stats, Catalog: catalog, Probe: probe, Tx: shared.Transactor, Now: infra.Now})
	providers := ai.NewProviderService(ai.ProviderDeps{Repo: repo, Stats: stats, Routes: routes, Catalog: catalog, Upstream: llm.NewClient(httpclient.New(httpclient.Options{Timeout: cfg.IdleTimeout})), Tx: shared.Transactor, Now: infra.Now})
	models := ai.NewModelService(ai.ModelDeps{Gateway: gateway, Repo: repo, Stats: stats, Routes: routes, Catalog: catalog, Tx: shared.Transactor, Now: infra.Now})
	usage := ai.NewUsageService(ai.UsageDeps{
		Gateway:  gateway,
		Repo:     repo,
		Requests: requests,
		Stats:    stats,
		Now:      infra.Now,
		Options: ai.UsageOptions{
			RequestRetention: time.Duration(cfg.RequestRetentionDays) * day,
			PayloadRetention: time.Duration(cfg.PayloadRetentionDays) * day,
			BreakdownLimit:   aiBreakdownLimit,
			CostSeries:       aiCostSeries,
		},
	})
	shared.AI = gateway

	modules.Handlers = append(modules.Handlers,
		aihttp.NewProviderHandler(providers, shared.Builder),
		aihttp.NewModelHandler(models, shared.Builder),
		aihttp.NewRouteHandler(routes, shared.Builder),
		aihttp.NewSceneHandler(ai.NewSceneService(gateway, repo, stats, infra.Now), shared.Builder),
		aihttp.NewCatalogHandler(catalog, shared.Builder),
		aihttp.NewUsageHandler(usage, shared.Builder),
		aihttp.NewPlaygroundHandler(ai.NewPlaygroundService(gateway, requests, uuid.NewString), shared.Builder),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, aijobs.Register(ai.NewNoticeService(repo, shared.Messages)))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, aijobs.Tasks(aijobs.TaskDeps{Prober: probe, Catalog: catalog, Offers: providers, Usage: usage})...)
}
