package bootstrap

import (
	"context"
	"net"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/b2"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/clamd"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/dlticket"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/banpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/downloadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/reportpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/scanpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/turnstile"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/ratelimit"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/downloadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reporthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/scanhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/uploadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/downloadjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/reportjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

const (
	uploadChunkPolicy   = "upload_chunk"
	uploadChunkLimit    = 10000
	vendorTimeout       = 15 * time.Second
	objectStoreTimeout  = 10 * time.Minute
	everyMinute         = "* * * * *"
	everyTenMinutes     = "*/10 * * * *"
	dailyAtMidnight     = "0 0 * * *"
	monthlyAtMidnight   = "0 0 1 * *"
	shortTaskTimeout    = 10 * time.Minute
	quotaTaskTimeout    = 30 * time.Minute
	scanTaskTimeout     = time.Hour
	transferQueueBudget = download.TransferConcurrency
)

type fileJobQueue struct {
	queue *queue.Queue
}

func (q fileJobQueue) Enqueue(ctx context.Context, job download.Job) error {
	return q.queue.Enqueue(ctx, job)
}

func wireFiles(infra *Infra, shared *Shared, modules *Modules) {
	cfg := shared.Config
	jobQueue := fileJobQueue{queue: shared.Queue}
	spool := localfs.NewSpool(cfg.Upload.RootDir, cfg.Upload.TempFileSuffix)
	store := objectstore.New(objectstore.Options{
		Bucket:          cfg.Storage.Game.Bucket,
		Region:          cfg.Storage.Game.Region,
		Endpoint:        cfg.Storage.Game.Endpoint,
		AccessKeyID:     cfg.Storage.Game.AccessKeyID,
		SecretAccessKey: cfg.Storage.Game.SecretAccessKey,
		HTTPClient:      httpclient.New(httpclient.Options{Timeout: objectStoreTimeout}),
	})
	banner := banpg.NewBanner(infra.Ent, shared.Families, shared.Transactor, shared.Now)

	quota := upload.NewQuotaService(uploadpg.NewQuotaRepository(infra.Ent), shared.Transactor, quotaPolicy(cfg), shared.Now)
	uploads := upload.NewService(uploadpg.NewRepository(infra.Ent), quota, spool, shared.Transactor, upload.Settings{
		ChunkSize:     cfg.Upload.ChunkSizeBytes,
		MaxChunks:     cfg.Upload.MaxChunks,
		MaxFileSize:   cfg.Upload.MaxFileSizeBytes,
		TransferLimit: cfg.Upload.TransferLimitBytes,
		SessionTTL:    cfg.Upload.SessionExpiresIn,
	}, shared.Now)

	downloadRepo := downloadpg.NewRepository(infra.Ent)
	downloads := download.NewService(download.Deps{
		Repo:       downloadRepo,
		Games:      shared.GameCards,
		Sessions:   uploads,
		Quota:      quota,
		Activities: shared.Activities,
		Messages:   shared.Messages,
		Tx:         shared.Transactor,
		Queue:      jobQueue,
		Store:      store,
		Now:        shared.Now,
	})
	vendorClient := httpclient.New(httpclient.Options{Timeout: vendorTimeout})
	links := download.NewLinks(
		downloadRepo,
		shared.Transactor,
		turnstile.New(cfg.Cloudflare.TurnstileSecret, "", vendorClient),
		b2.New(b2.Options{KeyID: cfg.Storage.B2ApplicationKeyID, Key: cfg.Storage.B2ApplicationKey, Client: vendorClient, Cache: shared.Cache}),
		dlticket.NewSealer(cfg.Download.TicketSecret),
		download.LinkSettings{
			Mode:           cfg.Download.Mode,
			CDNHost:        cfg.Download.CDNHost,
			WorkerHost:     cfg.Download.WorkerHost,
			MaxConns:       cfg.Download.MaxConns,
			BaseExpiresIn:  cfg.Download.ExpiresIn,
			EstimatedSpeed: cfg.Download.EstimatedSpeed,
			MaxExpiresIn:   cfg.Download.MaxExpiresIn,
		},
		shared.Now,
	)
	transfers := download.NewTransfers(downloadRepo, store, spool, quota, shared.Activities, shared.Messages, shared.Transactor, shared.Now)

	scans := scan.NewService(scan.Deps{
		Repo:     scanpg.NewRepository(infra.Ent),
		Archives: sevenzip.New(cfg.FileScan.ArchiveToolPath),
		Scanner: clamd.New(clamd.Options{
			Address: net.JoinHostPort(cfg.FileScan.ClamdHost, strconv.Itoa(cfg.FileScan.ClamdPort)),
			Timeout: cfg.FileScan.ClamdTimeout,
			LogDir:  cfg.FileScan.ScanLogDir,
		}),
		Files:      downloads,
		Local:      spool,
		Quota:      quota,
		Activities: shared.Activities,
		Messages:   shared.Messages,
		Banner:     banner,
		Queue:      jobQueue,
		Tx:         shared.Transactor,
		Settings: scan.Settings{
			Enabled:          cfg.FileScan.Enabled,
			ReviewTimeout:    cfg.FileScan.MalwareReviewTimeout,
			AutoBanThreshold: cfg.FileScan.MalwareAutoBanThreshold,
			AutoBanDays:      cfg.FileScan.MalwareAutoBanDays,
			AutoDeleteNote:   cfg.FileScan.MalwareAutoDeleteNote,
			SiteURL:          cfg.App.SiteURL,
		},
		Now: shared.Now,
	})

	reports := report.NewService(report.Deps{
		Repo:      reportpg.NewRepository(infra.Ent),
		Resources: downloads,
		Quota:     quota,
		Banner:    banner,
		Messages:  shared.Messages,
		Queue:     jobQueue,
		Tx:        shared.Transactor,
		SiteURL:   cfg.App.SiteURL,
		Now:       shared.Now,
	})

	chunkPolicy := ratelimit.Policy{Name: uploadChunkPolicy, Limit: uploadChunkLimit, Window: time.Minute, Block: cfg.Throttle.BlockDuration}
	modules.Handlers = append(modules.Handlers,
		uploadhttp.NewHandler(uploads, quota, shared.Builder, chunkPolicy),
		downloadhttp.NewHandler(downloads, links, shared.Builder),
		reporthttp.NewHandler(reports, shared.Builder),
		scanhttp.NewHandler(scans, shared.Builder),
	)

	modules.Jobs.Register = append(modules.Jobs.Register, downloadjobs.Register(transfers), reportjobs.Register(reports))
	modules.Jobs.Queues[download.TransferQueue] = transferQueueBudget
	modules.Jobs.Tasks = append(modules.Jobs.Tasks,
		jobs.Task{Name: "file_scan_pending", Schedule: everyMinute, Timeout: scanTaskTimeout, Run: scans.ScanPending},
		jobs.Task{Name: "malware_case_timeout", Schedule: everyMinute, Timeout: shortTaskTimeout, Run: scans.ExpireOverdue},
		jobs.Task{Name: "upload_session_cleanup", Schedule: everyMinute, Timeout: shortTaskTimeout, Run: func(ctx context.Context) error {
			if err := uploads.CleanStaleSessions(ctx); err != nil {
				return err
			}
			return uploads.CleanOrphans(ctx)
		}},
		jobs.Task{Name: "download_file_cleanup", Schedule: everyMinute, Timeout: shortTaskTimeout, Run: transfers.CleanFiles},
		jobs.Task{Name: "upload_quota_initial_grant", Schedule: everyTenMinutes, Timeout: quotaTaskTimeout, Run: quota.RunInitialGrants},
		jobs.Task{Name: "upload_quota_dynamic_topup", Schedule: everyTenMinutes, Timeout: quotaTaskTimeout, Run: quota.RunDynamicTopups},
		jobs.Task{Name: "upload_quota_dynamic_reduce", Schedule: dailyAtMidnight, Timeout: quotaTaskTimeout, Run: quota.RunDynamicReductions},
		jobs.Task{Name: "upload_quota_reset_used", Schedule: monthlyAtMidnight, Timeout: quotaTaskTimeout, Run: quota.RunMonthlyResets},
		jobs.Task{Name: "upload_quota_inactive_reset", Schedule: dailyAtMidnight, Timeout: quotaTaskTimeout, Run: quota.RunInactiveResets},
	)
}

func quotaPolicy(cfg *config.Config) upload.QuotaPolicy {
	location, err := time.LoadLocation(cfg.Tasks.ScheduleTimezone)
	if err != nil {
		location = time.UTC
	}
	return upload.QuotaPolicy{
		BaseBytes:           cfg.Upload.QuotaBaseBytes,
		CapBytes:            cfg.Upload.QuotaCapBytes,
		TopupStepBytes:      cfg.Upload.QuotaDynamicStepBytes,
		TopupThresholdBytes: cfg.Upload.QuotaDynamicThresholdBytes,
		ReduceStepBytes:     cfg.Upload.QuotaDynamicReduceStepBytes,
		ReduceInactiveDays:  cfg.Upload.QuotaReduceInactiveDays,
		GrantAfterDays:      cfg.Upload.QuotaGrantAfterDays,
		LongestInactiveDays: cfg.Upload.QuotaLongestInactiveDays,
		Location:            location,
	}
}
