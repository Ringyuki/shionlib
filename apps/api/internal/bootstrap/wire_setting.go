package bootstrap

import (
	"context"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/settingpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/refresh"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/settinghttp"
)

const (
	SettingsTopic           = "settings"
	settingsRefreshInterval = time.Minute
)

func buildSettings(infra *Infra, transactor *postgres.Transactor) (*setting.Service, *refresh.Watcher) {
	var settings *setting.Service
	watcher := refresh.NewWatcher(infra.Redis, infra.Logger, refresh.Options{
		Topic:    SettingsTopic,
		Interval: settingsRefreshInterval,
		Reload:   func(ctx context.Context) error { return settings.Reload(ctx) },
	})
	settings = setting.NewService(setting.Deps{Repo: settingpg.NewRepository(infra.Ent), Tx: transactor, Announcer: watcher})
	return settings, watcher
}

func wireSetting(_ *Infra, shared *Shared, modules *Modules) {
	modules.Handlers = append(modules.Handlers, settinghttp.NewHandler(shared.Settings, shared.Builder))
}
