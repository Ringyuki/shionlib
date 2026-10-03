package downloadjobs

import (
	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func Register(transfers *download.TransferService) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewStoreWorker(transfers))
		river.AddWorker(workers, NewPurgeWorker(transfers))
	}
}
