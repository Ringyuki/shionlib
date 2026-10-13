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

type routedJob interface {
	Queue() string
}

type limitedJob interface {
	MaxAttempts() int
}

type uniqueJob interface {
	UniqueByArgs() bool
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
	if _, err := q.client.Insert(ctx, job, InsertOptions(job)); err != nil {
		return fmt.Errorf("enqueue %s: %w", job.Kind(), err)
	}
	return nil
}

func InsertOptions(job Job) *river.InsertOpts {
	routed, hasQueue := job.(routedJob)
	limited, hasLimit := job.(limitedJob)
	unique, hasUnique := job.(uniqueJob)
	hasUnique = hasUnique && unique.UniqueByArgs()
	if !hasQueue && !hasLimit && !hasUnique {
		return nil
	}
	opts := &river.InsertOpts{}
	if hasQueue {
		opts.Queue = routed.Queue()
	}
	if hasLimit {
		opts.MaxAttempts = limited.MaxAttempts()
	}
	if hasUnique {
		opts.UniqueOpts = river.UniqueOpts{ByArgs: true, ByState: pendingStates}
	}
	return opts
}
