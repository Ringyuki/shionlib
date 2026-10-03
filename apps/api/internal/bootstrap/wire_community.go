package bootstrap

import (
	"context"
	"strings"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/ad"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/cloudflare"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/hmacsign"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/idatariver"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/nextmoe"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/pgdump"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/adpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/analysispg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/potatovnpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sponsorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/pvnapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/s3store"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/backup"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/analysishttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/moyuhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/potatovnhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sponsorhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/potatovnjobs"
)

const sponsorOrderAccessPurpose = "shionlib:sponsor-order-access"

func wireCommunity(_ *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config

	sponsorService := sponsor.NewService(
		sponsorpg.NewRepository(shared.Ent),
		idatariver.NewClient(httpclient.New(httpclient.Options{Timeout: 15 * time.Second}), idatariver.Options{
			BaseURL:   cfg.Sponsor.IdatariverBaseURL,
			Secret:    cfg.Sponsor.IdatariverSecret,
			ProjectID: cfg.Sponsor.IdatariverProjectID,
		}),
		shared.Cache,
		shared.Transactor,
		hmacsign.New(cfg.Token.Secret, sponsorOrderAccessPurpose),
		sponsor.Options{
			Enabled:     cfg.Sponsor.Enabled,
			Provider:    cfg.Sponsor.Provider,
			CallbackURL: strings.TrimSuffix(cfg.App.SiteURL, "/") + "/api/sponsor/webhook/idatariver",
		},
		shared.Now,
	)

	adRepository := adpg.NewRepository(shared.Ent)
	adService := ad.NewService(adRepository, adRepository, shared.Cache, shared.Now)

	moyuService := moyu.NewService(
		moyupg.NewGameStore(shared.Ent),
		nextmoe.NewClient(httpclient.New(httpclient.Options{Timeout: 10 * time.Second}), cfg.NextMoe.BaseURL, cfg.NextMoe.APIKey),
		shared.Cache,
	)

	pvnRepository := potatovnpg.NewRepository(shared.Ent)
	imageBucket := s3store.New(s3store.Options{Bucket: cfg.Storage.Image, HTTPClient: httpclient.New(httpclient.Options{Timeout: 30 * time.Second})})
	pvnService := potatovn.NewService(
		pvnRepository,
		pvnRepository,
		pvnapi.NewClient(httpclient.New(httpclient.Options{Timeout: 30 * time.Second}), cfg.PotatoVN.BaseURL),
		s3store.NewCoverStore(imageBucket),
		shared.Transactor,
		func(ctx context.Context, job potatovn.SyncLibraryJob) error {
			return shared.Queue.Enqueue(ctx, job)
		},
		shared.Now,
	)

	analytics := cloudflare.NewAnalytics(httpclient.New(httpclient.Options{Timeout: 15 * time.Second}), cloudflare.Options{
		AccountID:          cfg.Cloudflare.AccountID,
		Secret:             cfg.Cloudflare.AnalyticsSecret,
		ZoneID:             cfg.Cloudflare.AnalyticsZoneID,
		UseAnalyticsEngine: cfg.Download.Mode == "worker",
	})
	analysisService := analysis.NewService(analysispg.NewStatsStore(shared.Ent), analytics, analytics, shared.Cache, shared.Logger, shared.Now)

	modules.Handlers = append(modules.Handlers,
		sponsorhttp.NewHandler(sponsorService, shared.Builder),
		adhttp.NewHandler(adService, shared.Builder),
		moyuhttp.NewHandler(moyuService, shared.Builder),
		potatovnhttp.NewHandler(pvnService, shared.Builder),
		analysishttp.NewHandler(analysisService, shared.Builder),
	)
	modules.Jobs.Register = append(modules.Jobs.Register, potatovnjobs.Register(pvnService))
	modules.Jobs.Tasks = append(modules.Jobs.Tasks,
		jobs.Task{Name: "sponsor_expire_orders", Schedule: "*/10 * * * *", Timeout: time.Minute, Run: sponsorService.ExpireStaleOrders},
		jobs.Task{Name: "potatovn_clean_expired_bindings", Schedule: "0 0 * * *", Timeout: 5 * time.Minute, Run: pvnService.CleanExpiredBindings},
		jobs.Task{Name: "potatovn_schedule_library_sync", Schedule: "0 * * * *", Timeout: 5 * time.Minute, Run: pvnService.ScheduleLibrarySyncs},
		jobs.Task{Name: "potatovn_refresh_tokens", Schedule: "0 */6 * * *", Timeout: 30 * time.Minute, Run: pvnService.RefreshExpiringTokens},
	)

	if cfg.Database.BackupEnabled {
		backupBucket := s3store.New(s3store.Options{Bucket: cfg.Storage.Backup, HTTPClient: httpclient.New(httpclient.Options{Timeout: 15 * time.Minute})})
		backupService := backup.NewService(
			pgdump.New(cfg.Database.BackupPgDumpBinaryPath, cfg.Database.URL),
			s3store.NewBackupStore(backupBucket),
			backup.Retention{Daily: cfg.Database.BackupRetentionDaily, Weekly: cfg.Database.BackupRetentionWeekly},
			shared.Now,
		)
		modules.Jobs.Tasks = append(modules.Jobs.Tasks,
			jobs.Task{Name: "database_backup_daily", Schedule: "0 2 * * *", Timeout: 3 * time.Hour, Run: backupService.RunDaily},
			jobs.Task{Name: "database_backup_weekly", Schedule: "0 3 * * 0", Timeout: 3 * time.Hour, Run: backupService.RunWeekly},
		)
	}
}
