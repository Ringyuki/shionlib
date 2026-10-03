package potatovnjobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn"
	"github.com/Ringyuki/shionlib/apps/api/internal/potatovn/potatovntest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/potatovnjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
)

func TestSyncLibraryWorker(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	repo := potatovntest.NewMemoryRepository(func() time.Time { return now })
	client := potatovntest.NewClient()
	scheduler := &potatovntest.Scheduler{}
	service := potatovn.NewService(repo, repo, client, potatovntest.Covers{}, &txtest.Immediate{}, scheduler.Schedule, func() time.Time { return now })
	worker := potatovnjobs.NewSyncLibraryWorker(service)
	if _, err := repo.CreateBinding(ctx, potatovn.NewBinding{UserID: 1, Token: "t", TokenExpires: now.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	job := func(attempt int) *river.Job[potatovn.SyncLibraryJob] {
		return &river.Job[potatovn.SyncLibraryJob]{JobRow: &rivertype.JobRow{Attempt: attempt}, Args: potatovn.SyncLibraryJob{UserID: 1}}
	}
	if err := worker.Work(ctx, job(1)); err != nil {
		t.Fatal(err)
	}
	client.FailLibrary = potatovn.ErrRequestFailed
	if err := worker.Work(ctx, job(1)); !errors.Is(err, potatovn.ErrRequestFailed) {
		t.Fatalf("early failures are retried: %v", err)
	}
	var cancel *rivertype.JobCancelError
	if err := worker.Work(ctx, job(3)); !errors.As(err, &cancel) {
		t.Fatalf("the last attempt cancels the job: %v", err)
	}
	if worker.Timeout(job(1)) < time.Minute {
		t.Fatal("library syncs need more than the default job timeout")
	}
}
