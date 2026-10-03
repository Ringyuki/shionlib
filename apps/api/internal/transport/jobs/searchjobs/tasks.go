package searchjobs

import (
	"time"

	"github.com/riverqueue/river"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/search"
)

func RegisterIndex(indexer Refresher) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewIndexWorker(indexer))
	}
}

func Register(service *search.Service) func(workers *river.Workers) {
	return func(workers *river.Workers) {
		river.AddWorker(workers, NewRecordWorker(service))
	}
}

func Tasks(service *search.Service) []jobs.Task {
	return []jobs.Task{
		{Name: "search.decay_trends", Schedule: "0 * * * *", Timeout: 5 * time.Minute, Run: service.DecayTrends},
		{Name: "search.decay_suggestions", Schedule: "5 * * * *", Timeout: 10 * time.Minute, Run: service.DecaySuggestions},
		{Name: "search.trim_suggestions", Schedule: "10 * * * *", Timeout: 10 * time.Minute, Run: service.TrimSuggestions},
	}
}
