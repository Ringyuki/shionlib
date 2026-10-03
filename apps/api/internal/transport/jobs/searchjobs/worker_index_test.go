package searchjobs_test

import (
	"context"
	"testing"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/search"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/searchjobs"
)

type refresher struct {
	ids [][]int
}

func (r *refresher) Refresh(_ context.Context, ids []int) error {
	r.ids = append(r.ids, ids)
	return nil
}

func TestIndexWorkerRefreshesTheQueuedGames(t *testing.T) {
	r := &refresher{}
	worker := searchjobs.NewIndexWorker(r)
	job := &river.Job[search.IndexJob]{JobRow: &rivertype.JobRow{}, Args: search.IndexJob{GameIDs: []int{3, 4}}}
	if err := worker.Work(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	if len(r.ids) != 1 || len(r.ids[0]) != 2 || r.ids[0][0] != 3 || worker.Timeout(job) <= 0 {
		t.Fatalf("refreshed %v", r.ids)
	}
}
