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

type Queue struct {
	client *river.Client[pgx.Tx]
}

func New(client *river.Client[pgx.Tx]) *Queue {
	return &Queue{client: client}
}

func (q *Queue) Enqueue(ctx context.Context, job Job) error {
	if _, err := q.client.Insert(ctx, job, nil); err != nil {
		return fmt.Errorf("enqueue %s: %w", job.Kind(), err)
	}
	return nil
}
