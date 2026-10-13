package bootstrap

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hikarinagi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/catalogpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/cataloghttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/catalogjobs"
)

func buildCatalog(infra *Infra, shared *Shared) *catalog.Service {
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
	return catalog.NewService(catalog.Deps{
		Sources:   sources,
		Store:     catalogpg.NewStore(infra.Ent),
		Tx:        shared.Transactor,
		Queue:     shared.Queue,
		Followers: fileRenames{queue: shared.Queue},
		Settings:  shared.Settings,
		Now:       shared.Now,
		Options:   catalog.Options{CreatorID: cfg.CreatorID},
	})
}

func wireCatalogSync(_ *Infra, shared *Shared, modules *Modules) {
	service := shared.Catalog
	modules.Handlers = append(modules.Handlers, cataloghttp.NewHandler(service, shared.Builder))
	modules.Jobs.Register = append(modules.Jobs.Register, catalogjobs.Register(service))
	modules.Jobs.Queues[catalog.ImportQueue] = shared.Config.Catalog.ImportWorkers
	if len(service.Sources()) > 0 {
		modules.Jobs.Tasks = append(modules.Jobs.Tasks, catalogjobs.Tasks(service)...)
	}
}
