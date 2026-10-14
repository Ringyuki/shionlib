package bootstrap

import (
	"context"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/apikeypg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/openpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/apikeyredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/apikey"
	"github.com/Ringyuki/shionlib/apps/api/internal/open"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/apikeyhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/openhttp"
)

func wireOpen(infra *Infra, shared *Shared, modules *Modules) {
	deps := apikey.Deps{
		Repo:     apikeypg.NewRepository(shared.Ent),
		Usage:    apikeypg.NewUsageStore(shared.Ent),
		Counter:  apikeyredis.NewCounter(infra.Redis),
		Messages: shared.Messages,
		Tx:       shared.Transactor,
		Settings: shared.Settings,
		Now:      shared.Now,
	}
	access := apikey.NewAccessService(deps)
	modules.Keys = keyGate{access: access}
	lookups := open.NewService(openpg.NewRepository(shared.Ent), shared.Files.Downloads)
	modules.Handlers = append(modules.Handlers,
		apikeyhttp.NewHandler(apikey.NewService(deps), shared.Builder),
		apikeyhttp.NewAdminHandler(apikey.NewAdminService(deps), shared.Builder),
		openhttp.NewHandler(lookups, shared.Builder, shared.Config.App.SiteURL, shared.Config.App.Version),
	)
	modules.Jobs.Tasks = append(modules.Jobs.Tasks,
		jobs.Task{Name: "api_key_usage_flush", Schedule: everyTenMinutes, Timeout: shortTaskTimeout, Run: access.Flush},
	)
}

type keyGate struct {
	access *apikey.AccessService
}

func (g keyGate) AuthenticateKey(ctx context.Context, secret, ip string) (httpapi.KeyHolder, error) {
	holder, err := g.access.Authenticate(ctx, secret, ip)
	return httpapi.KeyHolder(holder), err
}

func (g keyGate) RecordKeyUse(ctx context.Context, holder httpapi.KeyHolder, throttled bool) error {
	return g.access.Record(ctx, apikey.Holder(holder), throttled)
}
