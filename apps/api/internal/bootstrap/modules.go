package bootstrap

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/jwt"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/favoritepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/favoritehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

type Registrar interface {
	Register(api *httpapi.API)
}

type Modules struct {
	Builder       *response.Builder
	Authenticator *auth.Authenticator
	Handlers      []Registrar
	Jobs          Jobs
}

func BuildModules(infra *Infra) *Modules {
	cfg := infra.Config
	builder := response.NewBuilder(infra.Catalog, infra.Now)
	tokens := jwt.NewCodec(cfg.Token.Secret, cfg.Token.ExpiresIn, infra.Now)
	families := authredis.NewFamilyBlocklist(infra.Redis)
	transactor := postgres.NewTransactor(infra.Ent)
	gameCards := game.NewCards(gamepg.NewCardStore(infra.Ent))

	modules := &Modules{
		Builder:       builder,
		Authenticator: auth.NewAuthenticator(tokens, families),
	}
	modules.Handlers = append(modules.Handlers,
		favoritehttp.NewHandler(favorite.NewService(favoritepg.NewRepository(infra.Ent), gameCards, transactor), builder),
	)
	return modules
}
