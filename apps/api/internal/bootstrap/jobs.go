package bootstrap

import (
	"fmt"
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

type Jobs struct {
	Register func(workers *river.Workers)
	Tasks    []jobs.Task
	Queues   map[string]int
}

func BuildJobs(infra *Infra, process bool, catalog Jobs) (*jobs.Runner, error) {
	location, err := time.LoadLocation(infra.Config.Tasks.ScheduleTimezone)
	if err != nil {
		return nil, fmt.Errorf("load schedule timezone: %w", err)
	}
	return jobs.New(jobs.Options{
		Pool:     infra.DB.Pool,
		Logger:   infra.Logger,
		Timezone: location,
		Queues:   catalog.Queues,
		Register: catalog.Register,
		Tasks:    catalog.Tasks,
		Process:  process,
	})
}
