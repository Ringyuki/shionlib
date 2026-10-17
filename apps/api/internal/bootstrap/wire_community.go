package bootstrap

import (
	"context"
	"crypto/rand"
	"math/big"
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
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/friendlinkpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/moyupg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/potatovnpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/sponsorpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/pvnapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/redis/adredis"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/s3store"
	"github.com/Ringyuki/shionlib/apps/api/internal/admin"
	"github.com/Ringyuki/shionlib/apps/api/internal/analysis"
	"github.com/Ringyuki/shionlib/apps/api/internal/backup"
	"github.com/Ringyuki/shionlib/apps/api/internal/friendlink"
	"github.com/Ringyuki/shionlib/apps/api/internal/moyu"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/sponsor"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/adhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/analysishttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/friendlinkhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/moyuhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/potatovnhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/sponsorhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/potatovnjobs"
)

const sponsorOrderAccessPurpose = "shionlib:sponsor-order-access"

func wireCommunity(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config

	paymentCallbacks := strings.TrimSuffix(cfg.App.SiteURL, "/") + "/api/sponsor/webhook/"
	sponsorService := sponsor.NewService(
		sponsorpg.NewRepository(shared.Ent),
		map[string]sponsor.Provider{
			idatariver.Name: idatariver.NewClient(httpclient.New(httpclient.Options{Timeout: 15 * time.Second}), shared.Settings),
		},
		shared.Transactor,
		hmacsign.New(cfg.Token.Secret, sponsorOrderAccessPurpose),
		shared.Settings,
		sponsor.Options{
			Provider:    idatariver.Name,
			CallbackURL: func(provider string) string { return paymentCallbacks + provider },
			ClockOffset: admin.StatsDayOffset,
		},
		shared.Now,
	)

	adRepository := adpg.NewRepository(shared.Ent)
	adOptions := ad.Options{ClockOffset: admin.StatsDayOffset}
	adService := ad.NewService(ad.Deps{Repo: adRepository, Cache: shared.Cache, Settings: shared.Settings, Now: shared.Now, Options: adOptions})
	adPlacements := ad.NewPlacementService(ad.PlacementDeps{
		Repo:     adRepository,
		Sponsors: adRepository,
		Cache:    shared.Cache,
		Guard:    adredis.NewClickGuard(infra.Redis),
		Settings: shared.Settings,
		Now:      shared.Now,
		Random:   randomFraction,
		Options:  adOptions,
	})

	nextMoe := nextmoe.NewClient(httpclient.New(httpclient.Options{Timeout: moyu.RequestTimeout}), cfg.NextMoe.BaseURL, cfg.NextMoe.APIKey)
	moyuService := moyu.NewService(moyupg.NewGameStore(shared.Ent), nextMoe, shared.Cache)
	patchPages := moyu.NewAssignmentService(moyupg.NewAssignmentStore(shared.Ent), nextMoe, shared.Cache)

	shared.Patches = moyuService

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
		adhttp.NewHandler(adService, adPlacements, shared.Builder),
		friendlinkhttp.NewHandler(friendlink.NewService(friendlinkpg.NewRepository(shared.Ent), shared.Transactor), shared.Builder),
		moyuhttp.NewHandler(moyuService, shared.Builder),
		moyuhttp.NewAdminHandler(patchPages, shared.Builder),
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

func randomFraction() float64 {
	const span = 1 << 53
	picked, err := rand.Int(rand.Reader, big.NewInt(span))
	if err != nil {
		return 0
	}
	return float64(picked.Int64()) / span
}
