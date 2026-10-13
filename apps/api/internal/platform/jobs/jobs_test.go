package jobs

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
	"github.com/robfig/cron/v3"
)

func noop(context.Context) error {
	return nil
}

func TestTaskRegistrationIsValidatedUpFront(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	_, err := New(Options{Logger: logger, Process: true, Tasks: []Task{{Name: "a", Schedule: "0 * * * *", Run: noop}, {Name: "a", Schedule: "5 * * * *", Run: noop}}})
	if err == nil || !strings.Contains(err.Error(), `"a" registered twice`) {
		t.Fatalf("duplicate task: %v", err)
	}
	_, err = New(Options{Logger: logger, Process: true, Tasks: []Task{{Name: "b", Schedule: "every minute", Run: noop}}})
	if err == nil || !strings.Contains(err.Error(), `scheduled task "b"`) {
		t.Fatalf("bad schedule: %v", err)
	}
}

func TestSchedulesRunInTheConfiguredTimezone(t *testing.T) {
	schedule, err := cron.ParseStandard("0 4 * * *")
	if err != nil {
		t.Fatal(err)
	}
	shanghai := time.FixedZone("UTC+8", 8*60*60)
	next := zonedSchedule{schedule: schedule, location: shanghai}.Next(time.Date(2026, 10, 3, 0, 0, 0, 0, time.UTC))
	if !next.Equal(time.Date(2026, 10, 3, 20, 0, 0, 0, time.UTC)) || next.Location() != time.UTC {
		t.Fatalf("04:00 UTC+8 is 20:00 UTC, got %s", next)
	}
}

func TestTaskWorkerRunsTheNamedTaskUnderItsTimeout(t *testing.T) {
	var deadline time.Time
	failing := errors.New("refresh failed")
	worker := &taskWorker{logger: slog.New(slog.DiscardHandler), tasks: map[string]Task{
		"ok": {Name: "ok", Timeout: time.Minute, Run: func(ctx context.Context) error {
			deadline, _ = ctx.Deadline()
			return nil
		}},
		"fails": {Name: "fails", Run: func(context.Context) error { return failing }},
	}}
	job := func(name string) *river.Job[scheduledTask] {
		return &river.Job[scheduledTask]{JobRow: &rivertype.JobRow{}, Args: scheduledTask{Name: name}}
	}
	if err := worker.Work(t.Context(), job("ok")); err != nil || deadline.IsZero() || worker.Timeout(job("ok")) != time.Minute {
		t.Fatalf("ok task: %v %s", err, deadline)
	}
	if err := worker.Work(t.Context(), job("fails")); !errors.Is(err, failing) {
		t.Fatalf("failures are returned for the error handler: %v", err)
	}
	var cancel *rivertype.JobCancelError
	if err := worker.Work(t.Context(), job("gone")); !errors.As(err, &cancel) {
		t.Fatalf("unknown tasks are cancelled, not retried: %v", err)
	}
}
