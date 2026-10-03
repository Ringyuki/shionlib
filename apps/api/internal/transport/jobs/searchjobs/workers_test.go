package searchjobs_test

import (
	"context"
	"testing"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/searchjobs"
)

func TestRecordWorkerAndTasks(t *testing.T) {
	analytics := searchtest.NewAnalytics()
	service := search.NewService(search.Dependencies{Analytics: analytics})
	worker := searchjobs.NewRecordWorker(service)
	job := &river.Job[search.RecordSearchJob]{JobRow: &rivertype.JobRow{}, Args: search.RecordSearchJob{Query: " Sakura "}}
	if err := worker.Work(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	if analytics.Trends[search.WindowHour]["sakura"] != 1 {
		t.Fatalf("the worker records the normalized query: %+v", analytics.Trends)
	}
	if (search.RecordSearchJob{}).Kind() != "search_analytics" {
		t.Fatal("job kind changed")
	}

	tasks := searchjobs.Tasks(service)
	schedules := map[string]string{}
	for _, task := range tasks {
		schedules[task.Name] = task.Schedule
		if err := task.Run(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if schedules["search.decay_trends"] != "0 * * * *" || schedules["search.decay_suggestions"] != "5 * * * *" || schedules["search.trim_suggestions"] != "10 * * * *" {
		t.Fatalf("unexpected schedules %v", schedules)
	}
	if analytics.DecayCalls != 2 || analytics.TrimmedKeep != search.MaxCandidatesPerPrefix {
		t.Fatalf("tasks must run the analytics maintenance: %d %d", analytics.DecayCalls, analytics.TrimmedKeep)
	}
}
