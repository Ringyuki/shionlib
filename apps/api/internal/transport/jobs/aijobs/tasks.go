package aijobs

import (
	"context"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

const (
	probeSchedule   = "*/10 * * * *"
	probeTimeout    = 5 * time.Minute
	catalogSchedule = "17 * * * *"
	catalogTimeout  = 5 * time.Minute
	offersSchedule  = "0 6 * * *"
	offersTimeout   = 15 * time.Minute
	purgeSchedule   = "0 4 * * *"
	purgeTimeout    = 10 * time.Minute
)

type Prober interface {
	ProbeSuspended(ctx context.Context) error
}

type CatalogSyncer interface {
	SyncIfStale(ctx context.Context) error
}

type OfferSyncer interface {
	SyncOffers(ctx context.Context) error
}

type Purger interface {
	Purge(ctx context.Context) error
}

type TaskDeps struct {
	Prober  Prober
	Catalog CatalogSyncer
	Offers  OfferSyncer
	Usage   Purger
}

func Register(announcer Announcer) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewRouteStatusWorker(announcer))
	}
}

func Tasks(deps TaskDeps) []jobs.Task {
	return []jobs.Task{
		{Name: "ai_probe_suspended_routes", Schedule: probeSchedule, Timeout: probeTimeout, Run: deps.Prober.ProbeSuspended},
		{Name: "ai_sync_catalog", Schedule: catalogSchedule, Timeout: catalogTimeout, Run: deps.Catalog.SyncIfStale},
		{Name: "ai_sync_offers", Schedule: offersSchedule, Timeout: offersTimeout, Run: deps.Offers.SyncOffers},
		{Name: "ai_purge_requests", Schedule: purgeSchedule, Timeout: purgeTimeout, Run: deps.Usage.Purge},
	}
}
