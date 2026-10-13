package moderationjobs

import (
	"context"
	"testing"
	"time"

	"github.com/riverqueue/river"
)

type requeuer struct {
	cutoffs []time.Time
}

func (r *requeuer) RequeueStaleReviews(_ context.Context, updatedBefore time.Time) error {
	r.cutoffs = append(r.cutoffs, updatedBefore)
	return nil
}

func TestRequeueTaskLooksBackOneHour(t *testing.T) {
	r := &requeuer{}
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	tasks := Tasks(r, func() time.Time { return now })
	if len(tasks) != 1 || tasks[0].Name != "moderation_requeue_stale_reviews" || tasks[0].Schedule != "*/30 * * * *" {
		t.Fatalf("tasks %+v", tasks)
	}
	if err := tasks[0].Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(r.cutoffs) != 1 || !r.cutoffs[0].Equal(now.Add(-time.Hour)) {
		t.Fatalf("cutoffs %v", r.cutoffs)
	}
}

func TestRegisterAddsEveryWorker(t *testing.T) {
	workers := river.NewWorkers()
	Register(newFixture(t).service)(workers)
}
