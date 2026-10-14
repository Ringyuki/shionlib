package bootstrap

import (
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/indexnow"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/indexingpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/indexingredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/indexing"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/indexinghttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/indexingjobs"
)

const indexNowTimeout = 30 * time.Second

func wireIndexing(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	siteURL := strings.TrimSuffix(cfg.App.SiteURL, "/")
	key := indexnow.KeyFrom(cfg.Token.Secret)
	submitter := indexnow.New(indexnow.Options{
		Endpoint: indexnow.DefaultEndpoint,
		SiteURL:  siteURL,
		Key:      key,
		Client:   httpclient.New(httpclient.Options{Timeout: indexNowTimeout}),
	})
	service := indexing.NewService(indexingpg.NewChangeStore(shared.Ent), submitter, indexingredis.NewCursor(infra.Redis), shared.Settings, indexing.Options{SiteURL: siteURL, Key: key}, shared.Now)
	modules.Handlers = append(modules.Handlers, indexinghttp.NewHandler(service, shared.Builder))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks, indexingjobs.PushTask(service, shared.Logger))
}
