package compositionjobs

import (
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/composition"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

const (
	cleanSchedule = "*/10 * * * *"
	cleanTimeout  = 10 * time.Minute
)

func Register(reads *composition.ReadService, runs *composition.RunService) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewReadWorker(reads))
		river.AddWorker(workers, NewRunWorker(runs))
	}
}

func Tasks(cleaner *composition.CleanService) []jobs.Task {
	return []jobs.Task{{Name: "composition_clean", Schedule: cleanSchedule, Timeout: cleanTimeout, Run: cleaner.Clean}}
}
