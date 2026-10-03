package bootstrap

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/healthhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
)

const apiTitle = "Shionlib API"

func BuildHTTP(infra *Infra, modules *Modules) *httpapi.API {
	cfg := infra.Config
	api := httpapi.New(httpapi.Options{
		Title:          apiTitle,
		Version:        cfg.App.Version,
		ExposeOpenAPI:  cfg.HTTP.ExposeOpenAPI,
		Logger:         infra.Logger,
		Catalog:        infra.Catalog,
		Builder:        modules.Builder,
		ClientResolver: clientinfo.NewResolver(cfg.TrustedProxyPrefixes()),
		Authenticator:  modules.Authenticator,
		CORS:           httpapi.CORS{Origins: cfg.HTTP.CORSOrigins, Methods: cfg.HTTP.CORSMethods},
		QuietPaths:     []string{"/health"},
		Throttling: &httpapi.Throttling{
			Limiter: ratelimit.New(infra.Redis),
			Policies: map[string]ratelimit.Policy{
				httpapi.DefaultThrottle: {Name: httpapi.DefaultThrottle, Limit: cfg.Throttle.Limit, Window: cfg.Throttle.TTL, Block: cfg.Throttle.BlockDuration},
				"download":              {Name: "download", Limit: cfg.Throttle.DownloadLimit, Window: cfg.Throttle.DownloadTTL, Block: cfg.Throttle.DownloadBlockDuration},
				"auth":                  {Name: "auth", Limit: cfg.Throttle.AuthLimit, Window: cfg.Throttle.AuthTTL, Block: cfg.Throttle.AuthBlockDuration},
			},
		},
	})
	healthhttp.NewHandler(modules.Builder, 3*time.Second,
		healthhttp.Check{Name: "db", Pinger: infra.DB},
		healthhttp.Check{Name: "redis", Pinger: redisPinger{infra.Redis}},
	).Register(api)
	for _, handler := range modules.Handlers {
		handler.Register(api)
	}
	return api
}
