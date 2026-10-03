package queue

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
)

type Job = interface {
	Kind() string
}

type routedJob interface {
	Queue() string
}

type Queue struct {
	client *river.Client[pgx.Tx]
}

func New(client *river.Client[pgx.Tx]) *Queue {
	return &Queue{client: client}
}

func (q *Queue) Enqueue(ctx context.Context, job Job) error {
	var opts *river.InsertOpts
	if routed, ok := job.(routedJob); ok && routed.Queue() != "" {
		opts = &river.InsertOpts{Queue: routed.Queue()}
	}
	if _, err := q.client.Insert(ctx, job, opts); err != nil {
		return fmt.Errorf("enqueue %s: %w", job.Kind(), err)
	}
	return nil
}
