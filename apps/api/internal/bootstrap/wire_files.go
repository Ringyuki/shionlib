package bootstrap

import (
	"context"
	"net"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/b2"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/clamd"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/dlticket"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/localfs"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/objectstore"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/downloadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/reportpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/scanpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/uploadpg"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/sevenzip"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/turnstile"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/httpclient"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/report"
	"github.com/Ringyuki/shionlib/apps/api/internal/scan"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/downloadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/reporthttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/scanhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/uploadhttp"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/downloadjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/reportjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
	"github.com/Ringyuki/shionlib/apps/api/internal/user"
)

const (
	storeRequeueAge     = 15 * time.Minute
	vendorTimeout       = 15 * time.Second
	scanWorkspaceDir    = ".work"
	objectStoreTimeout  = 10 * time.Minute
	everyMinute         = "* * * * *"
	everyTenMinutes     = "*/10 * * * *"
	shortTaskTimeout    = 10 * time.Minute
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
	banner := userPenalties{users: shared.Users}

	quota := newQuotaService(infra, shared)
	uploads := upload.NewService(uploadpg.NewRepository(infra.Ent), quota, spool, shared.Transactor, shared.Settings, shared.Now)

	downloadRepo := downloadpg.NewRepository(infra.Ent)
	downloads := download.NewService(download.Deps{
		Repo:       downloadRepo,
		Games:      shared.GameCards,
		Sessions:   uploads,
		Activities: shared.Activities,
		Messages:   shared.Messages,
		Tx:         shared.Transactor,
		Queue:      jobQueue,
		Store:      store,
		Local:      spool,
		Settings:   shared.Settings,
		Now:        shared.Now,
	})
	vendorClient := httpclient.New(httpclient.Options{Timeout: vendorTimeout})
	links := download.NewLinkService(
		downloadRepo,
		shared.Transactor,
		turnstile.New(cfg.Cloudflare.TurnstileSecret, "", vendorClient),
		b2.New(b2.Options{KeyID: cfg.Storage.B2ApplicationKeyID, Key: cfg.Storage.B2ApplicationKey, Client: vendorClient, Cache: shared.Cache}),
		dlticket.NewSealer(cfg.Download.TicketSecret),
		shared.Settings,
		download.LinkOptions{
			Mode:       cfg.Download.Mode,
			CDNHost:    cfg.Download.CDNHost,
			WorkerHost: cfg.Download.WorkerHost,
		},
		shared.Now,
	)
	transfers := download.NewTransferService(downloadRepo, store, spool, shared.Activities, shared.Messages, shared.Transactor, shared.Now)

	scans := scan.NewService(scan.Deps{
		Repo:     scanpg.NewRepository(infra.Ent),
		Archives: sevenzip.New(cfg.FileScan.ArchiveToolPath),
		Scanner: clamd.New(clamd.Options{
			Address: net.JoinHostPort(cfg.FileScan.ClamdHost, strconv.Itoa(cfg.FileScan.ClamdPort)),
			Timeout: cfg.FileScan.ClamdTimeout,
			LogDir:  cfg.FileScan.ScanLogDir,
		}),
		Workspace:  localfs.NewWorkspace(filepath.Join(cfg.Upload.RootDir, scanWorkspaceDir)),
		Spool:      uploads,
		Files:      downloads,
		Activities: shared.Activities,
		Messages:   shared.Messages,
		Banner:     banner,
		Mailer:     shared.Mailer,
		Queue:      jobQueue,
		Tx:         shared.Transactor,
		Settings:   shared.Settings,
		Options: scan.Options{
			Enabled: cfg.FileScan.Enabled,
			SiteURL: cfg.App.SiteURL,
		},
		Now: shared.Now,
	})

	reports := report.NewService(report.Deps{
		Repo:      reportpg.NewRepository(infra.Ent),
		Resources: downloads,
		Banner:    banner,
		Mailer:    shared.Mailer,
		Messages:  shared.Messages,
		Queue:     jobQueue,
		Tx:        shared.Transactor,
		SiteURL:   cfg.App.SiteURL,
		Now:       shared.Now,
	})

	modules.Handlers = append(modules.Handlers,
		uploadhttp.NewHandler(uploads, quota, shared.Builder),
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
		jobs.Task{Name: "download_store_requeue", Schedule: everyTenMinutes, Timeout: shortTaskTimeout, Run: func(ctx context.Context) error {
			return downloads.RequeueStores(ctx, shared.Now().Add(-storeRequeueAge))
		}},
	)
}

func newQuotaService(infra *Infra, shared *Shared) *upload.QuotaService {
	return upload.NewQuotaService(uploadpg.NewQuotaRepository(infra.Ent), shared.Settings, shared.Now)
}

type userPenalties struct {
	users *user.Service
}

func (p userPenalties) Ban(ctx context.Context, userID int, bannedBy *int, reason string, days int) (bool, error) {
	return p.users.Penalize(ctx, userID, bannedBy, reason, days)
}
