package downloadjobs

import (
	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

func Register(transfers *download.TransferService, names *download.NameService) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewStoreWorker(transfers))
		river.AddWorker(workers, NewPurgeWorker(transfers))
		river.AddWorker(workers, NewRenameWorker(names))
	}
}
