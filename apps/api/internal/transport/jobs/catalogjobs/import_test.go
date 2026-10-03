package catalogjobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/Ringyuki/shionlib/apps/api/internal/catalog"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/jobs/catalogjobs"
)

type importerFunc func(ctx context.Context, ref catalog.Ref) (int, error)

func (f importerFunc) Import(ctx context.Context, ref catalog.Ref) (int, error) {
	return f(ctx, ref)
}

type syncer struct {
	refreshed, pulled int
}

func (s *syncer) RefreshStale(context.Context) error {
	s.refreshed++
	return nil
}

func (s *syncer) PullChanges(context.Context) error {
	s.pulled++
	return nil
}

func TestImportWorkerMapsOutcomesToJobResults(t *testing.T) {
	job := &river.Job[catalog.ImportJob]{Args: catalog.ImportJob{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "77"}}
	cases := []struct {
		name  string
		err   error
		check func(t *testing.T, err error)
	}{
		{name: "success", check: func(t *testing.T, err error) {
			if err != nil {
				t.Fatal(err)
			}
		}},
		{name: "gone at the source completes", err: catalog.ErrEntryNotFound.New(), check: func(t *testing.T, err error) {
			if err != nil {
				t.Fatal(err)
			}
		}},
		{name: "unknown source cancels", err: catalog.ErrUnknownSource.New(), check: func(t *testing.T, err error) {
			var cancel *rivertype.JobCancelError
			if !errors.As(err, &cancel) {
				t.Fatalf("expected cancel, got %v", err)
			}
		}},
		{name: "rate limit snoozes", err: catalog.ErrRateLimited, check: func(t *testing.T, err error) {
			var snooze *rivertype.JobSnoozeError
			if !errors.As(err, &snooze) || snooze.Duration != time.Minute {
				t.Fatalf("expected snooze, got %v", err)
			}
		}},
		{name: "other errors retry", err: errors.New("boom"), check: func(t *testing.T, err error) {
			var cancel *rivertype.JobCancelError
			if err == nil || errors.As(err, &cancel) {
				t.Fatalf("expected a retryable error, got %v", err)
			}
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got catalog.Ref
			worker := catalogjobs.NewImportWorker(importerFunc(func(_ context.Context, ref catalog.Ref) (int, error) {
				got = ref
				return 1, tc.err
			}))
			tc.check(t, worker.Work(context.Background(), job))
			if got != (catalog.Ref{Source: catalog.SourceHikarinagi, Entity: catalog.EntityGame, ExternalID: "77"}) {
				t.Fatalf("ref %+v", got)
			}
		})
	}
}

func TestTasksRunTheSyncer(t *testing.T) {
	s := &syncer{}
	tasks := catalogjobs.Tasks(s)
	names := map[string]bool{}
	for _, task := range tasks {
		names[task.Name] = true
		if task.Timeout <= 0 || task.Schedule == "" {
			t.Fatalf("task %+v", task)
		}
		if err := task.Run(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if !names["catalog_changes"] || !names["catalog_refresh"] || s.refreshed != 1 || s.pulled != 1 {
		t.Fatalf("tasks %v syncer %+v", names, s)
	}
}
