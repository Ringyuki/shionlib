package searchjobs_test

import (
	"context"
	"testing"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/search/searchtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/searchjobs"
)

func TestTasksMaintainTheAnalytics(t *testing.T) {
	analytics := searchtest.NewAnalytics()
	service := search.NewService(search.Deps{Analytics: analytics})
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
