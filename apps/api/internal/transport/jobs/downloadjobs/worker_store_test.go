package downloadjobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/download/downloadtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/downloadjobs"
	"github.com/Ringyuki/shionlib/apps/api/internal/txtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload/uploadtest"
)

type noQuota struct{}

func (noQuota) Withdraw(context.Context, int, int) error {
	return nil
}

func TestBackoffDoublesUpToAnHour(t *testing.T) {
	cases := map[int]time.Duration{1: time.Minute, 2: 2 * time.Minute, 3: 4 * time.Minute, 7: time.Hour, 30: time.Hour}
	for attempt, want := range cases {
		if got := downloadjobs.Backoff(time.Minute, attempt); got != want {
			t.Fatalf("attempt %d: got %s want %s", attempt, got, want)
		}
	}
}

func TestStoreWorkerCancelsWhenTheLocalFileIsGone(t *testing.T) {
	now := time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC)
	repo := downloadtest.NewMemoryRepository(func() time.Time { return now })
	resource := repo.SeedResource(download.Resource{GameID: 1, CreatorID: 1})
	path := "/spool/missing.part"
	file := repo.SeedFile(download.File{ResourceID: resource.ID, Path: &path, Status: download.FileOnServer, CheckStatus: download.CheckOK})
	events := &downloadtest.Recorder{}
	transfers := download.NewTransferService(repo, downloadtest.NewObjectStore(), uploadtest.NewMemorySpool(), noQuota{}, events, events, &txtest.Immediate{}, func() time.Time { return now })
	downloadjobs.Register(transfers)(river.NewWorkers())
	worker := downloadjobs.NewStoreWorker(transfers)
	job := &river.Job[download.StoreFile]{JobRow: &rivertype.JobRow{Attempt: 1}, Args: download.StoreFile{FileID: file.ID}}
	if worker.Timeout(job) < time.Hour {
		t.Fatal("large transfers need a long timeout")
	}
	err := worker.Work(context.Background(), job)
	var cancel *river.JobCancelError
	if !errors.As(err, &cancel) {
		t.Fatalf("missing local files cancel the job: %v", err)
	}
}
