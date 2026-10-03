package queue

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
)

type Job interface {
	Kind() string
}

type routedJob interface {
	Queue() string
}

type limitedJob interface {
	MaxAttempts() int
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
	if !hasQueue && !hasLimit {
		return nil
	}
	opts := &river.InsertOpts{}
	if hasQueue {
		opts.Queue = routed.Queue()
	}
	if hasLimit {
		opts.MaxAttempts = limited.MaxAttempts()
	}
	return opts
}
