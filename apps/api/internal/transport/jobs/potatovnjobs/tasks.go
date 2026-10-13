package potatovnjobs

import (
	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
)

func Register(service *potatovn.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewSyncLibraryWorker(service))
	}
}
