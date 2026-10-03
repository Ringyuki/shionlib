package bootstrap

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hikarinagi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/catalogpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/cataloghttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/catalogjobs"
)

const catalogImportWorkers = 2

func wireCatalogSync(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config.Catalog
	var sources []catalog.Source
	if cfg.Source == catalog.SourceHikarinagi && cfg.Hikarinagi.ClientID != "" && cfg.Hikarinagi.ClientSecret != "" {
		client := hikarinagi.NewClient(hikarinagi.Options{
			BaseURL:        cfg.Hikarinagi.APIBaseURL,
			TokenURL:       cfg.Hikarinagi.TokenURL,
			ClientID:       cfg.Hikarinagi.ClientID,
			ClientSecret:   cfg.Hikarinagi.ClientSecret,
			Resource:       cfg.Hikarinagi.Resource,
			Scopes:         cfg.Hikarinagi.Scopes,
			RequestsPerMin: cfg.Hikarinagi.RequestsPerMin,
			HTTPClient:     httpclient.New(httpclient.Options{Timeout: cfg.Hikarinagi.Timeout}),
		})
		sources = append(sources, hikarinagi.NewSource(client))
	}
	service := catalog.NewService(sources, catalogpg.NewStore(infra.Ent), shared.Transactor, shared.Queue, shared.Now, catalog.Options{
		CreatorID:    cfg.CreatorID,
		RefreshAfter: cfg.RefreshInterval,
		RefreshBatch: cfg.RefreshBatch,
		ChangesBatch: cfg.ChangesBatch,
	})
	modules.Handlers = append(modules.Handlers, cataloghttp.NewHandler(service, shared.Builder))
	modules.Jobs.Register = append(modules.Jobs.Register, catalogjobs.NewImportWorker(service).Register)
	modules.Jobs.Queues[catalog.ImportQueue] = catalogImportWorkers
	if len(sources) > 0 {
		modules.Jobs.Tasks = append(modules.Jobs.Tasks, catalogjobs.Tasks(service)...)
	}
}
