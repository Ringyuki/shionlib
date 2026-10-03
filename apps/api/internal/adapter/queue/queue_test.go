package queue_test

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgtest"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/queue"
	"github.com/Ringyuki/shionlib/apps/api/internal/platform/jobs"
)

type plainJob struct {
	Value int `json:"value"`
}

func (plainJob) Kind() string { return "queue_test_plain" }

type routedJob struct {
	Value int `json:"value"`
}

func (routedJob) Kind() string { return "queue_test_routed" }

func (routedJob) Queue() string { return "queue_test_lane" }

func TestEnqueueHonoursJobQueues(t *testing.T) {
	db := pgtest.New(t)
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, db.URL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := jobs.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	inserter, err := jobs.NewInserter(pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	q := queue.New(inserter)
	if err := q.Enqueue(ctx, plainJob{Value: 1}); err != nil {
		t.Fatal(err)
	}
	if err := q.Enqueue(ctx, routedJob{Value: 2}); err != nil {
		t.Fatal(err)
	}
	rows, err := pool.Query(ctx, `SELECT kind, queue FROM river_job ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got [][2]string
	for rows.Next() {
		var kind, name string
		if err := rows.Scan(&kind, &name); err != nil {
			t.Fatal(err)
		}
		got = append(got, [2]string{kind, name})
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	want := [][2]string{{"queue_test_plain", "default"}, {"queue_test_routed", "queue_test_lane"}}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("got %v, want %v", got, want)
	}
}
