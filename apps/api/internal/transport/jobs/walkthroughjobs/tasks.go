package walkthroughjobs

import (
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const formatTimeout = 11 * time.Minute

func Register(formats *walkthrough.FormatService) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewFormatWorker(formats))
	}
}
