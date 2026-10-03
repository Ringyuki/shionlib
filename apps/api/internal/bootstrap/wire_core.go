package bootstrap

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/favoritepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/favorite"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/activityhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/favoritehttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/messagehttp"
)

func wireFavorite(infra *Infra, shared *Shared, modules *Modules) {
	service := favorite.NewService(favoritepg.NewRepository(infra.Ent), shared.GameCards, shared.Transactor)
	modules.Handlers = append(modules.Handlers, favoritehttp.NewHandler(service, shared.Builder))
}

func wireMessage(_ *Infra, shared *Shared, modules *Modules) {
	modules.Handlers = append(modules.Handlers, messagehttp.NewHandler(shared.Messages, shared.Realtime, shared.Builder))
}

func wireActivity(_ *Infra, shared *Shared, modules *Modules) {
	modules.Handlers = append(modules.Handlers, activityhttp.NewHandler(shared.Activities, shared.Builder))
}
