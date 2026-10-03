package bootstrap

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/jwt"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/clientinfo"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/healthhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

const apiTitle = "Shionlib API"

func BuildHTTP(infra *Infra) *httpapi.API {
	cfg := infra.Config
	builder := response.NewBuilder(infra.Catalog, infra.Now)
	tokens := jwt.NewCodec(cfg.Token.Secret, cfg.Token.ExpiresIn, infra.Now)
	authenticator := auth.NewAuthenticator(tokens, authredis.NewFamilyBlocklist(infra.Redis))

	api := httpapi.New(httpapi.Options{
		Title:          apiTitle,
		Version:        cfg.App.Version,
		ExposeOpenAPI:  cfg.HTTP.ExposeOpenAPI,
		Logger:         infra.Logger,
		Catalog:        infra.Catalog,
		Builder:        builder,
		ClientResolver: clientinfo.NewResolver(cfg.TrustedProxyPrefixes()),
		Authenticator:  authenticator,
		CORS:           httpapi.CORS{Origins: cfg.HTTP.CORSOrigins, Methods: cfg.HTTP.CORSMethods},
		QuietPaths:     []string{"/health"},
	})

	healthhttp.NewHandler(builder, 3*time.Second,
		healthhttp.Check{Name: "db", Pinger: infra.DB},
		healthhttp.Check{Name: "redis", Pinger: redisPinger{infra.Redis}},
	).Register(api)

	return api
}
