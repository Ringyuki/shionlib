package bootstrap

import (
	"log/slog"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/email"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/jwt"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/activitypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/gamepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/messagepg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/push"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/authredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/auth"
	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/cache"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/realtime"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/redis"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const emailTimeout = 15 * time.Second

type Registrar interface {
	Register(api *httpapi.API)
}

type Modules struct {
	Builder       *response.Builder
	Authenticator *auth.AuthenticationService
	Realtime      *realtime.Hub
	Handlers      []Registrar
	Jobs          Jobs
}

type Shared struct {
	Config     *config.Config
	Logger     *slog.Logger
	Now        func() time.Time
	Ent        *ent.Client
	Redis      *redis.Client
	Builder    *response.Builder
	Transactor *postgres.Transactor
	Cache      *cache.Cache
	Queue      *queue.Queue
	Realtime   *realtime.Hub
	Tokens     *jwt.Codec
	Families   *authredis.FamilyBlocklist
	GameCards  *game.CardService
	Messages   *message.Service
	Activities *activity.Service
	Catalog    *catalog.Service
	Search     *search.IndexService
	Mailer     *email.Mailer
	Sessions   *auth.SessionService
	Users      *user.Service
}

type wiring func(infra *Infra, shared *Shared, modules *Modules)

var wirings = []wiring{
	wireFavorite,
	wireMessage,
	wireActivity,
	wireAuth,
	wireContent,
	wireFiles,
	wireCatalog,
	wireCatalogSync,
	wireCommunity,
	wireAdmin,
}

func BuildModules(infra *Infra) *Modules {
	shared := buildShared(infra)
	modules := &Modules{
		Builder:       shared.Builder,
		Authenticator: auth.NewAuthenticationService(shared.Tokens, shared.Families),
		Realtime:      shared.Realtime,
		Jobs:          Jobs{Queues: map[string]int{}},
	}
	for _, wire := range wirings {
		wire(infra, shared, modules)
	}
	return modules
}

func buildShared(infra *Infra) *Shared {
	cfg := infra.Config
	hub := realtime.NewHub(infra.Redis, infra.Logger)
	transactor := postgres.NewTransactor(infra.Ent)
	gameCards := game.NewCardService(gamepg.NewCardStore(infra.Ent))
	shared := &Shared{
		Config:     cfg,
		Logger:     infra.Logger,
		Now:        infra.Now,
		Ent:        infra.Ent,
		Redis:      infra.Redis,
		Builder:    response.NewBuilder(infra.Catalog, infra.Now),
		Transactor: transactor,
		Cache:      cache.New(infra.Redis),
		Queue:      infra.Queue,
		Realtime:   hub,
		Tokens:     jwt.NewCodec(cfg.Token.Secret, cfg.Token.ExpiresIn, infra.Now),
		Families:   authredis.NewFamilyBlocklist(infra.Redis),
		GameCards:  gameCards,
	}
	shared.Activities = activity.NewService(activitypg.NewRepository(infra.Ent), gameCards)
	shared.Messages = message.NewService(messagepg.NewRepository(infra.Ent), push.NewMessageNotifier(hub, infra.Logger), gameCards, transactor, infra.Now)
	shared.Search = BuildSearchIndexer(infra)
	shared.Catalog = buildCatalog(infra, shared)
	shared.Mailer = email.NewMailer(email.NewSender(email.Options{
		Provider:      cfg.Email.Provider,
		APIKey:        cfg.Email.APIKey,
		Endpoint:      cfg.Email.Endpoint,
		SenderAddress: cfg.Email.SenderAddress,
		SenderName:    cfg.Email.SenderName,
	}, httpclient.New(httpclient.Options{Timeout: emailTimeout})), infra.Catalog)
	return shared
}
