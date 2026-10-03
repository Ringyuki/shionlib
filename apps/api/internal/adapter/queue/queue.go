package queue

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"
)

type Job = interface {
	Kind() string
}

type uniqueJob interface {
	UniqueByArgs() bool
}

type queuedJob interface {
	QueueName() string
}

type limitedJob interface {
	MaxAttempts() int
}

var pendingStates = []rivertype.JobState{
	rivertype.JobStateAvailable,
	rivertype.JobStatePending,
	rivertype.JobStateRetryable,
	rivertype.JobStateRunning,
	rivertype.JobStateScheduled,
}

type Queue struct {
	client *river.Client[pgx.Tx]
}

func New(client *river.Client[pgx.Tx]) *Queue {
	return &Queue{client: client}
}

func (q *Queue) Enqueue(ctx context.Context, job Job) error {
	if _, err := q.client.Insert(ctx, job, insertOpts(job)); err != nil {
		return fmt.Errorf("enqueue %s: %w", job.Kind(), err)
	}
	return nil
}

func insertOpts(job Job) *river.InsertOpts {
	opts := &river.InsertOpts{}
	if queued, ok := job.(queuedJob); ok {
		opts.Queue = queued.QueueName()
	}
	if limited, ok := job.(limitedJob); ok {
		opts.MaxAttempts = limited.MaxAttempts()
	}
	if unique, ok := job.(uniqueJob); ok && unique.UniqueByArgs() {
		opts.UniqueOpts = river.UniqueOpts{ByArgs: true, ByState: pendingStates}
	}
	return opts
}
