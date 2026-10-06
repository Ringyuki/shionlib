package bootstrap

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/healthhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/searchhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/uploadhttp"
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
		QuietPaths:     []string{"/health", "/socket.io"},
		Throttling: &httpapi.Throttling{
			Limiter:  ratelimit.New(infra.Redis),
			Settings: modules.Settings,
			Policies: map[string]httpapi.ThrottlePolicy{
				httpapi.DefaultThrottle:  {Limit: httpapi.DefaultThrottleLimit, Window: httpapi.DefaultThrottleWindow, Block: httpapi.DefaultThrottleBlock},
				"download":               {Limit: httpapi.DownloadThrottleLimit, Window: httpapi.DownloadThrottleWindow, Block: httpapi.DownloadThrottleBlock},
				"auth":                   {Limit: httpapi.AuthThrottleLimit, Window: httpapi.AuthThrottleWindow, Block: httpapi.AuthThrottleBlock},
				searchhttp.Throttle:      {Limit: httpapi.SearchThrottleLimit, Window: httpapi.SearchThrottleWindow, Block: httpapi.DefaultThrottleBlock},
				uploadhttp.ChunkThrottle: {Limit: httpapi.UploadChunkThrottleLimit, Window: httpapi.UploadChunkThrottleWindow, Block: httpapi.DefaultThrottleBlock},
			},
		},
	})
	healthhttp.NewHandler(modules.Builder, 3*time.Second, map[string]healthhttp.Pinger{
		"db":    infra.DB,
		"redis": redisPinger{infra.Redis},
	}).Register(api)
	for _, handler := range modules.Handlers {
		handler.Register(api)
	}
	return api
}
