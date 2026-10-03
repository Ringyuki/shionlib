package reportjobs

import (
	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/report"
)

func Register(service *report.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewAlertWorker(service))
	}
}
