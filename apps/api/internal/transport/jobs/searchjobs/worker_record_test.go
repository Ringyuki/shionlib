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

func TestRecordWorkerRecordsTheNormalizedQuery(t *testing.T) {
	analytics := searchtest.NewAnalytics()
	service := search.NewService(search.Deps{Analytics: analytics})
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
}
